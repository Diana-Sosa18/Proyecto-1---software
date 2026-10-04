jest.mock("../../database/mysql", () => ({ pool: {} }));
const { createCheckoutService } = require("../recurrenteCheckoutService");
const { CheckoutError } = require("../recurrenteCheckoutErrors");
const remote = { id_externo: "ch_unit_fixture", checkout_url: "https://app.recurrente.com/checkout-session/ch_unit_fixture", estado_proveedor: "unpaid" };

function fixture({ monto = "100.00", recargo = "15.00", pagado = "0.00", owned = true, exists = true, review = false } = {}) {
  const rows = [];
  const totals = { recargo, pagado };
  const connection = { beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn() };
  connection.execute = jest.fn(async (sql, p) => {
    if (sql.includes("FROM CUOTA cu")) return [owned ? [{ id_cuota: 3, id_casa: 8, id_residente: 2, monto, concepto: "Mantenimiento" }] : []];
    if (sql.startsWith("SELECT id_cuota FROM CUOTA")) return [exists ? [{ id_cuota: 3 }] : []];
    if (sql.includes("SUM(monto_recargo)")) return [[totals]];
    if (sql.includes('FROM EVENTO_RECURRENTE er')) return [review ? [{id_checkout:1}] : []];
    if (sql.includes("FROM CHECKOUT_RECURRENTE")) return [rows.filter((r) => ["CREADO", "PENDIENTE", "INCIERTO"].includes(r.estado)).map((r) => ({ ...r }))];
    if (sql.includes("INSERT INTO CHECKOUT_RECURRENTE")) {
      const keys = ["referencia_local", "idempotency_key", "id_cuota", "id_usuario", "id_residente", "id_casa", "monto_centavos", "capital_centavos", "recargo_centavos", "sandbox_id"];
      rows.push({ ...Object.fromEntries(keys.map((k, i) => [k, p[i]])), id_checkout: rows.length + 1, moneda: "GTQ", ambiente: "sandbox", estado: "CREADO" });
      return [{ insertId: rows.length }];
    }
    if (sql.includes("SET estado='INCIERTO'")) { Object.assign(rows.find((r) => r.id_checkout === p[0]), { estado: "INCIERTO" }); return [{ affectedRows: 1 }]; }
    if (sql.includes("SET id_externo=?")) {
      Object.assign(rows.find((r) => r.id_checkout === p[4]), { id_externo: p[0], checkout_url: p[1], estado_proveedor: p[2], estado: "PENDIENTE", error_codigo: p[3] });
      return [{ affectedRows: 1 }];
    }
    if (sql.includes("SET estado=?,error_codigo=?")) { Object.assign(rows.find((r) => r.id_checkout === p[5]), { estado: p[0], error_codigo: p[1] }); return [{ affectedRows: 1 }]; }
    throw new Error("Unexpected SQL fixture");
  });
  const client = { sandboxId: jest.fn(() => "sbx_unit_fixture"),
    createCheckout: jest.fn(async (local, beforeRequest) => {
      expect(rows[0].estado).toBe("CREADO");
      expect(connection.commit).toHaveBeenCalled();
      await beforeRequest();
      expect(rows[0].estado).toBe("INCIERTO");
      return remote;
    }), getCheckout: jest.fn(async () => remote) };
  const service = createCheckoutService({ pool: { getConnection: async () => connection }, client });
  return { service, rows, totals, client, connection };
}

test.each([
  ["100.00", "15.00", "0", 11500, 10000, 1500],
  ["100.00", "15.00", "50", 6500, 6500, 0],
  ["100.00", "15.00", "10", 10500, 10000, 500],
  ["10.01", "0", "0", 1001, 1001, 0],
])("saldo comun monto %s recargo %s abono %s se persiste en centavos", async (monto, recargo, pagado, amount, capital, surcharge) => {
  const f = fixture({ monto, recargo, pagado });
  expect(await f.service.startResidentCheckout(4, 3)).toEqual({ referencia_local: expect.any(String), checkout_url: remote.checkout_url });
  expect(f.rows[0]).toMatchObject({ id_cuota: 3, id_usuario: 4, id_residente: 2, id_casa: 8, monto_centavos: amount, capital_centavos: capital, recargo_centavos: surcharge, estado: "PENDIENTE", moneda: "GTQ", ambiente: "sandbox" });
  expect(f.connection.execute.mock.calls[0][0]).toContain("FOR UPDATE");
  expect(f.connection.execute.mock.calls[1][0]).not.toMatch(/fecha|BETWEEN/);
  expect(f.connection.execute.mock.calls.some(([sql]) => /INSERT INTO (PAGO|TRANSACCION_|EVENTO_|REEMBOLSO_)/.test(sql))).toBe(false);
});
test('éxito en revisión bloquea checkout antes de llamar al proveedor',async()=>{
  const f=fixture({review:true});await expect(f.service.startResidentCheckout(4,3)).rejects.toMatchObject({code:'CHECKOUT_UNCERTAIN'});
  expect(f.rows).toHaveLength(0);expect(f.client.createCheckout).not.toHaveBeenCalled();expect(f.client.getCheckout).not.toHaveBeenCalled();
});
test.each([
  [{ owned: false }, "QUOTA_NOT_OWNED"], [{ owned: false, exists: false }, "QUOTA_NOT_FOUND"],
  [{ pagado: "115" }, "QUOTA_PAID"], [{ pagado: "120" }, "FINANCIAL_OVERPAYMENT"],
  [{ monto: "4.99", recargo: "0" }, "CHECKOUT_MINIMUM"],
])("rechaza obligacion sin crear checkout %s", async (options, code) => {
  const f = fixture(options);
  await expect(f.service.startResidentCheckout(4, 3)).rejects.toMatchObject({ code });
  expect(f.rows).toHaveLength(0); expect(f.client.createCheckout).not.toHaveBeenCalled();
  expect(f.connection.rollback).toHaveBeenCalled();
});
test.each([0, -1, "3", null, 3.5, 2147483648])("rechaza identificador invalido %s", async (id) => {
  const f = fixture(); await expect(f.service.startResidentCheckout(4, id)).rejects.toMatchObject({ code: "INVALID_QUOTA" });
  expect(f.connection.execute).not.toHaveBeenCalled();
});
test("reutiliza compatible verificando GET sin otro INSERT ni POST", async () => {
  const f = fixture(); const first = await f.service.startResidentCheckout(4, 3);
  expect(await f.service.startResidentCheckout(4, 3)).toEqual(first);
  expect(f.rows).toHaveLength(1); expect(f.client.createCheckout).toHaveBeenCalledTimes(1); expect(f.client.getCheckout).toHaveBeenCalledTimes(1);
});
test.each([ ["monto_centavos", 12000], ["moneda", "USD"], ["ambiente", "production"],
  ["sandbox_id", "sbx_other"], ["id_usuario", 5], ["id_residente", 5], ["id_casa", 10] ])("no reutiliza si cambia %s", async (key, value) => {
  const f = fixture(); await f.service.startResidentCheckout(4, 3); f.rows[0][key] = value;
  await expect(f.service.startResidentCheckout(4, 3)).rejects.toMatchObject({ code: "CHECKOUT_INCOMPATIBLE" });
  expect(f.rows).toHaveLength(1); expect(f.client.getCheckout).not.toHaveBeenCalled();
});
test.each(["CHECKOUT_TIMEOUT", "CHECKOUT_PROVIDER_UNAVAILABLE", "CHECKOUT_INVALID_RESPONSE"])("%s queda INCIERTO y bloquea reintento", async (code) => {
  const f = fixture(); f.client.createCheckout.mockImplementation(async (_local, before) => { await before(); throw new CheckoutError(code, { uncertain: true }); });
  await expect(f.service.startResidentCheckout(4, 3)).rejects.toMatchObject({ code });
  expect(f.rows[0].estado).toBe("INCIERTO");
  await expect(f.service.startResidentCheckout(4, 3)).rejects.toMatchObject({ code: "CHECKOUT_UNCERTAIN" });
  expect(f.client.createCheckout).toHaveBeenCalledTimes(1);
});
test("rechazo definitivo permite un nuevo intento sin alterar el fallido", async () => {
  const f = fixture(); f.client.createCheckout.mockRejectedValueOnce(new CheckoutError("CHECKOUT_PROVIDER_REJECTED"));
  await expect(f.service.startResidentCheckout(4, 3)).rejects.toMatchObject({ code: "CHECKOUT_PROVIDER_REJECTED" });
  expect(f.rows[0].estado).toBe("FALLIDO"); f.client.createCheckout.mockImplementation(async (_local, before) => { await before(); return remote; });
  await f.service.startResidentCheckout(4, 3); expect(f.rows).toHaveLength(2);
});
test.each(["paid", "payment_in_progress", "expired"])("respuesta %s no registra pago ni devuelve URL para cobrar", async (estado_proveedor) => {
  const f = fixture(); f.client.createCheckout.mockImplementation(async (_local, before) => { await before(); return { ...remote, estado_proveedor }; });
  await expect(f.service.startResidentCheckout(4, 3)).rejects.toMatchObject({ code: "CHECKOUT_NOT_USABLE" });
  expect(f.rows[0].estado).toBe("PENDIENTE");
  expect(f.connection.execute.mock.calls.some(([sql]) => /INSERT INTO PAGO/.test(sql))).toBe(false);
});
test("cambio de saldo durante llamada impide publicar checkout incompatible", async () => {
  const f = fixture(); f.client.createCheckout.mockImplementation(async (_local, before) => { await before(); f.totals.pagado = "10"; return remote; });
  await expect(f.service.startResidentCheckout(4, 3)).rejects.toMatchObject({ code: "CHECKOUT_INCOMPATIBLE" });
  expect(f.rows[0]).toMatchObject({ estado: "PENDIENTE", error_codigo: "CHECKOUT_INCOMPATIBLE" });
});
