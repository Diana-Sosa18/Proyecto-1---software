const { guatemalaToday } = require("../utils/guatemalaTime");

// Regla unica del estado de una cuota para TODAS las vistas (Mis pagos, Cargos y
// pagos, estado de cuenta del inquilino). Usa el saldo canonico de financialBalance
// (los recargos ya estan incluidos en el saldo) y la fecha de negocio de Guatemala.
// Una cuota que vence hoy sigue PENDIENTE; pasa a VENCIDA desde el dia siguiente.
// Sin fecha limite no puede estar vencida (CUOTA.fecha_limite es NOT NULL; solo
// aplica a filas parciales de pruebas o integraciones).
const QUOTA_STATUSES = Object.freeze({
  PAID: "PAGADA",
  PENDING: "PENDIENTE",
  OVERDUE: "VENCIDA",
});

function getQuotaStatus({ saldo, fecha_limite }, today = guatemalaToday()) {
  if (Number(saldo) <= 0) return QUOTA_STATUSES.PAID;
  const dueDate = String(fecha_limite || "");
  return dueDate && dueDate < today ? QUOTA_STATUSES.OVERDUE : QUOTA_STATUSES.PENDING;
}

// Informativo, independiente del estado: hay abonos netos pero queda saldo.
function isPartiallyPaid({ saldo, abono_neto }) {
  return Number(saldo) > 0 && Number(abono_neto) > 0;
}

module.exports = { QUOTA_STATUSES, getQuotaStatus, isPartiallyPaid };
