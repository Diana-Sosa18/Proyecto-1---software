const { checkoutStatus } = require("../recurrenteCheckoutStatus");
const local = { estado: "PENDIENTE", estado_proveedor: "unpaid", id_externo: "ch_TEST" };
const balance = { saldo: 115, requiere_revision: false };
test.each([
  ["FALLIDA", "BANK_DECLINED", "RECHAZADO"], ["FALLIDA", "INTENT_FAILED", "FALLIDO"], ["CANCELADA", "INTENT_CANCELED", "CANCELADO"],
])("intento %s no vuelve terminal el checkout", (resultado_intento, motivo_codigo, estado) => {
  expect(checkoutStatus(local, { resultado_intento, motivo_codigo }, balance)).toMatchObject({ estado, accion: "CONTINUAR" });
});
test.each(["paid", "payment_in_progress"])("checkout %s bloquea otro intento", (estado_proveedor) => {
  expect(checkoutStatus({ ...local, estado_proveedor }, null, balance).accion).toBe("NINGUNA");
});
test("incierto no se libera por fallo", () => {
  expect(checkoutStatus({ ...local, estado: "INCIERTO" }, { resultado_intento: "FALLIDA" }, balance)).toMatchObject({ estado: "INCIERTO", accion: "NINGUNA" });
});
test("confirmado no vuelve rechazado por entrega fuera de orden", () => {
  expect(checkoutStatus({ ...local, estado: "CONFIRMADO" }, { resultado_intento: "FALLIDA" }, { ...balance, saldo: 0 })).toMatchObject({ estado: "CONFIRMADO", accion: "NINGUNA" });
});
test("saldo cero y sobrepago impiden retry", () => {
  for (const b of [{ saldo: 0 }, { saldo: 0, requiere_revision: true }]) expect(checkoutStatus(local, null, b).accion).toBe("NINGUNA");
});
test("expirado solo ofrece retry si se verificó autoritativamente", () => {
  const expired = { ...local, estado: "EXPIRADO", estado_proveedor: "expired" };
  expect(checkoutStatus(expired, null, balance).accion).toBe("NINGUNA");
  expect(checkoutStatus({ ...expired, verificado_en: "2026-10-02 15:00:00" }, null, balance).accion).toBe("REINTENTAR");
});
test("no expone IDs, motivos arbitrarios ni URL", () => {
  expect(Object.keys(checkoutStatus(local, null, balance)).sort()).toEqual(["accion", "estado", "mensaje"]);
});
test("checkout anterior terminal no ofrece retry si hay otra operación bloqueante", () => {
  expect(checkoutStatus({ ...local, estado: "EXPIRADO", estado_proveedor: "expired", verificado_en: "TEST" }, null, balance, true)).toMatchObject({ estado: "PENDIENTE", accion: "NINGUNA" });
});
test("saldo bajo Q5 no ofrece un cobro aumentado", () => {
  expect(checkoutStatus(local, null, { saldo: 4 })).toMatchObject({ estado: "NO_COMPLETADO", accion: "NINGUNA" });
});
test('éxito en revisión prevalece sobre intento fallido y no ofrece retry',()=>{
  expect(checkoutStatus(local,{resultado_intento:'FALLIDA',motivo_codigo:'INTENT_FAILED'},balance,false,false,true))
    .toMatchObject({estado:'INCIERTO',accion:'NINGUNA',mensaje:expect.stringContaining('No intentes pagar nuevamente')});
});
