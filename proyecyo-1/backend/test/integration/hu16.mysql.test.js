const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { configureTestEnvironment, connect } = require("./support/isolatedMysql");

if (process.env.RUN_PHASE0_MYSQL_TESTS !== "1") {
  test("HU16 exige infraestructura MySQL TEST aislada", { skip: true }, () => {});
} else {
  require("./support/suiteIsolation").assertOwnedSuiteDatabase();
  configureTestEnvironment(); // Credentials empty BEFORE any app/config import.
  const db = require("../../src/database/mysql");
  const { getPaymentReceipt, getResidentTransactionReceipt, listResidentRecurrenteReceipts, createPaymentReceiptPdf } = require("../../src/services/paymentReceiptService");
  const { QUOTA_BALANCES_SQL } = require("../../src/services/financialBalance");
  const { receiptPdfText } = require("./support/receiptPdfText");
  const originalFetch = global.fetch;
  global.fetch = (url, options) => {
    assert.equal(new URL(url).hostname, "127.0.0.1", "HU16 never calls Recurrente or any external API");
    return originalFetch(url, options);
  };
  let connection, server, base, auth, otherAuth, adminAuth, receipt, protectedBefore;
  const query = async (sql, params = []) => (await connection.query(sql, params))[0];
  async function snapshot() {
    const output = {};
    for (const [table, column, ids] of [["CUOTA", "id_cuota", "171,998"], ["PAGO", "id_cuota", "171,998"],
      ["PAGO_ORIGEN", "id_cuota", "171,998"], ["TRANSACCION_RECURRENTE", "id_cuota", "171,998"],
      ["CHECKOUT_RECURRENTE", "id_cuota", "171,998"], ["EVENTO_RECURRENTE", "id_evento", "348,349,859,860"]]) {
      output[table] = await query(`SELECT * FROM ${table} WHERE ${column} IN (${ids}) ORDER BY 1`);
    }
    return output;
  }
  async function get(path, token = auth) { return fetch(`${base}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }); }
  async function unconfirmedFixture(state) {
    const id = (await query("INSERT INTO CUOTA(id_servicio,id_casa,monto,fecha_limite) VALUES(1,1,5,'2026-11-10')")).insertId;
    const idCheckout = (await query("INSERT INTO CHECKOUT_RECURRENTE SET ?", { referencia_local: randomUUID(), idempotency_key: randomUUID(),
      id_externo: `ch_HU16_TEST_${randomUUID().replaceAll("-", "")}`, id_cuota: id, id_usuario: 3, id_residente: 1, id_casa: 1,
      monto_centavos: 500, capital_centavos: 500, recargo_centavos: 0, moneda: "GTQ", ambiente: "sandbox", estado: "PENDIENTE", estado_proveedor: "unpaid" })).insertId;
    return (await query("INSERT INTO TRANSACCION_RECURRENTE SET ?", { id_checkout: idCheckout, id_externo: `in_HU16_TEST_${randomUUID().replaceAll("-", "")}`,
      idempotency_key: randomUUID(), id_cuota: id, id_usuario: 3, id_casa: 1, monto_centavos: 500, moneda: "GTQ", ambiente: "sandbox", estado: state })).insertId;
  }
  describe("HU16 recibos locales MySQL TEST + HTTP, sin proveedor", { concurrency: false }, () => {
    before(async () => {
      connection = await connect(); protectedBefore = await snapshot();
      assert.equal(protectedBefore.PAGO.length, 1); assert.equal(protectedBefore.PAGO[0].id_pago, 395);
      const [type] = await query("SELECT id_tipo_usuario FROM TIPO_USUARIO WHERE LOWER(nombre)='residente'");
      const uid = randomUUID().replaceAll("-", "");
      const other = (await query("INSERT INTO USUARIO(nombre,dpi,correo,password,activo,id_tipo_usuario) VALUES(?,?,?,?,TRUE,?)",
        ["HU16 IDOR TEST", `hu16${uid.slice(0, 16)}`, `hu16-${uid}@example.test`, "HU16_TEST_ONLY", type.id_tipo_usuario])).insertId;
      const { createActiveSession } = require("../../src/services/activeSessionsService");
      auth = (await createActiveSession(3)).token; otherAuth = (await createActiveSession(other)).token; adminAuth = (await createActiveSession(1)).token;
      server = require("../../src/app").createApp().listen(0, "127.0.0.1"); await new Promise((resolve) => server.once("listening", resolve));
      base = `http://127.0.0.1:${server.address().port}`;
      receipt = await getPaymentReceipt(3, "residente", 395);
    });
    after(async () => {
      try { assert.deepEqual(await snapshot(), protectedBefore, "Every protected real row must remain unchanged"); }
      finally { if (server) await new Promise((resolve) => server.close(resolve)); await connection?.end(); await db.pool.end(); global.fetch = originalFetch; }
    });
    for (const [field, expected] of Object.entries({ id_pago: 395, id_cuota: 171, numero_comprobante: "NXR-00000395", fecha_pago: "2026-10-02",
      monto_pagado: 5, moneda: "GTQ", servicio: "HU13 Sandbox Q5 TEST", estado: "CONFIRMADO", proveedor: "Recurrente", titular_nombre: "Residente Demo",
      unidad: "B-302", referencia_transaccion: "in_y4hil51d", referencia_pago_externa: "pa_xzdhbyna", ambiente: "sandbox", id_transaccion: 296, id_checkout: 433 })) {
      test(`PAGO 395: ${field} autoritativo`, () => assert.equal(receipt[field], expected));
    }
    test("transacción confirmada 296 reconstruye el mismo comprobante", async () => assert.deepEqual(await getResidentTransactionReceipt(3, 296), receipt));
    test("historial incluye PAGO 395 y excluye cuota 998", async () => {
      const list = await listResidentRecurrenteReceipts(3); assert.equal(list.filter((r) => r.id_pago === 395).length, 1); assert.equal(list.some((r) => r.id_cuota === 998), false);
    });
    test("PDF real contiene los datos esenciales y marca Sandbox", async () => {
      const pdf = await createPaymentReceiptPdf(receipt); assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
      const text = receiptPdfText(pdf); for (const value of ["NXR-00000395", "2026-10-02", "Q5.00", "GTQ", "Confirmado", "Recurrente", "Residente Demo", "B-302", "HU13 Sandbox Q5 TEST", "in_y4hil51d", "SANDBOX / PRUEBA"]) assert(text.includes(value), value);
    });
    test("HTTP JSON real coincide con el servicio y no permite cache", async () => {
      const res = await get("/residente/pagos/395/comprobante/datos"); assert.equal(res.status, 200); assert.equal(res.headers.get("cache-control"), "private, no-store"); assert.deepEqual(await res.json(), receipt);
    });
    test("HTTP consulta/descarga repetida no crea pagos, transacciones ni cambios de saldo", async () => {
      const before = await snapshot();
      for (let i = 0; i < 3; i++) {
        assert.deepEqual(await (await get("/residente/pagos/395/comprobante/datos")).json(), receipt);
        const res = await get("/residente/pagos/395/comprobante"); assert.equal(res.status, 200); assert.equal(res.headers.get("content-type"), "application/pdf");
        assert.match(res.headers.get("content-disposition"), /comprobante-NXR-00000395\.pdf/);
        assert(receiptPdfText(Buffer.from(await res.arrayBuffer())).includes("SANDBOX / PRUEBA"));
      }
      assert.deepEqual(await snapshot(), before);
      const balances = await query(`SELECT id_cuota,saldo_pendiente FROM (${QUOTA_BALANCES_SQL}) b WHERE id_cuota IN (171,998) ORDER BY id_cuota`);
      assert.deepEqual(balances.map((b) => [b.id_cuota, Number(b.saldo_pendiente)]), [[171, 0], [998, 5]]);
    });
    test("FALLIDA 486 y checkout unpaid 937 nunca permiten comprobante", async () => {
      const [negative] = await query("SELECT tr.estado,tr.id_pago,co.estado_proveedor FROM TRANSACCION_RECURRENTE tr JOIN CHECKOUT_RECURRENTE co ON co.id_checkout=tr.id_checkout WHERE tr.id_transaccion=486 AND co.id_checkout=937 AND tr.id_cuota=998");
      assert.equal(negative.estado, "FALLIDA"); assert.equal(negative.id_pago, null); assert.equal(negative.estado_proveedor, "unpaid");
      await assert.rejects(getResidentTransactionReceipt(3, 486), { status: 409, code: "RECEIPT_NOT_CONFIRMED" });
      const res = await get("/residente/pagos/recurrente/transacciones/486/comprobante"); assert.equal(res.status, 409); assert.equal((await res.json()).code, "RECEIPT_NOT_CONFIRMED");
      assert.equal((await query("SELECT COUNT(*) n FROM PAGO WHERE id_cuota=998"))[0].n, 0);
    });
    for (const state of ["CANCELADA", "PENDIENTE"]) test(`${state} sin id_pago no emite comprobante`, async () => {
      const id = await unconfirmedFixture(state); const res = await get(`/residente/pagos/recurrente/transacciones/${id}/comprobante`); assert.equal(res.status, 409);
    });
    test("residente distinto no accede a JSON, PDF ni referencia de transacción (IDOR)", async () => {
      for (const path of ["/residente/pagos/395/comprobante/datos", "/residente/pagos/395/comprobante", "/residente/pagos/recurrente/transacciones/296/comprobante"]) {
        const res = await get(path, otherAuth); assert.equal(res.status, 404); assert.doesNotMatch(await res.text(), /NXR-00000395|in_y4hil51d|HU13 Sandbox/);
      }
      const list = await (await get("/residente/pagos/recurrente/comprobantes", otherAuth)).json(); assert.deepEqual(list, []);
    });
    test("no autenticado no recibe JSON ni PDF", async () => {
      for (const path of ["/residente/pagos/395/comprobante/datos", "/residente/pagos/395/comprobante", "/residente/pagos/recurrente/comprobantes"]) assert.equal((await get(path, null)).status, 401);
    });
    test("no amplía permisos del administrador", async () => assert.equal((await get("/residente/pagos/395/comprobante/datos", adminAuth)).status, 403));
    test("ID inexistente devuelve 404 seguro", async () => {
      const res = await get("/residente/pagos/2147483647/comprobante/datos"); assert.equal(res.status, 404); assert.doesNotMatch(await res.text(), /SELECT|mysql|stack|secret|signature/i);
    });
    test("query arbitraria no cambia identidad ni valores del comprobante", async () => {
      const res = await get("/residente/pagos/395/comprobante/datos?id_usuario=1&monto=900&estado=CONFIRMADO"); assert.deepEqual(await res.json(), receipt);
    });
    test("JSON/PDF no contienen credenciales, firmas ni payloads", async () => {
      assert.doesNotMatch(JSON.stringify(receipt), /secret|signature|payload|svix|card|cvc|checkout_url|titular_correo/i);
      assert.doesNotMatch(receiptPdfText(await createPaymentReceiptPdf(receipt)), /secret|signature|payload|svix|CVC/i);
    });
  });
}
