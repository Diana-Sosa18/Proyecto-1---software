// Public catalogue: no external IDs, raw reasons, payloads, secrets or checkout
// URL. The POST always rechecks these decisions; GET status never calls Recurrente.
function checkoutStatus(local, attempt, balance, otherBlocking = false, refundBlocking = false, reviewBlocking = false) {
  const result = (estado, mensaje, accion = "NINGUNA") => ({ estado, mensaje, accion });
  if (balance.requiere_revision) return result("INCIERTO", "La cuota requiere revisión antes de iniciar otro pago.");
  if (refundBlocking) return result("PENDIENTE", "Existe un reembolso pendiente, incierto o en revisión; no puede iniciarse otro cobro.");
  if (local.estado === "CONFIRMADO" && Number(balance.reembolsado || 0)>0) return result("CONFIRMADO", "El pago original fue confirmado y posteriormente reembolsado. Consulta tu estado de cuenta para ver el saldo actual.");
  if (local.estado === "CONFIRMADO") return result("CONFIRMADO", "El pago fue confirmado y registrado por el servidor.");
  if (reviewBlocking) return result('INCIERTO','Recibimos información adicional del proveedor y estamos verificando el resultado. No intentes pagar nuevamente.');
  if (Number(balance.saldo) === 0) return result("CUOTA_PAGADA", "La cuota no tiene saldo pendiente. No puede iniciarse otro cobro.");
  if (otherBlocking) return result("PENDIENTE", "Existe otra operación en curso para esta cuota. Consulta tu estado de cuenta para continuarla.");
  if (Number(balance.saldo) < 5) return result("NO_COMPLETADO", "El saldo es menor al mínimo de Q5 de Recurrente. No se aumentará ni se iniciará otro cobro.");
  if (local.estado === "INCIERTO") return result("INCIERTO", "El resultado requiere verificación. No puede iniciarse otro cobro.");
  if (local.estado === "CREADO" || ["paid", "payment_in_progress"].includes(local.estado_proveedor)) {
    return result("PENDIENTE", "La operación está pendiente de verificación. No puede iniciarse otro checkout.");
  }
  const usable = local.estado === "PENDIENTE" && local.estado_proveedor === "unpaid";
  const retry = local.estado === "EXPIRADO" && local.estado_proveedor === "expired" && local.verificado_en
    || local.estado === "FALLIDO" && !local.id_externo;
  const action = usable ? "CONTINUAR" : retry ? "REINTENTAR" : "NINGUNA";
  if (attempt?.resultado_intento === "CANCELADA") return result("CANCELADO", "El proveedor confirmó un intento cancelado. La cuota conserva su saldo pendiente.", action);
  if (attempt?.resultado_intento === "FALLIDA") return result(attempt.motivo_codigo === "BANK_DECLINED" ? "RECHAZADO" : "FALLIDO",
    attempt.motivo_codigo === "BANK_DECLINED" ? "El banco rechazó el intento de pago. No se registró un abono."
      : "El intento de pago no se completó. No se registró un abono.", action);
  if (retry) return result("NO_COMPLETADO", "El checkout anterior no puede cobrar. Puedes solicitar otro intento de forma segura.", action);
  return result("PENDIENTE", "El regreso desde el checkout no confirma el pago. Consulta el estado registrado por el servidor.", action);
}
module.exports = { checkoutStatus };
