const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const providerId = (v, prefix) => typeof v === 'string' && new RegExp(`^${prefix}_[A-Za-z0-9_-]{1,180}$`).test(v);
const HISTORICAL_SUCCESS = ['CONFIRMADA', 'REEMBOLSADA_PARCIAL', 'REEMBOLSADA'];
const RESERVED = ['SOLICITADO', 'PENDIENTE', 'INCIERTO', 'REVISION'];
class RefundError extends Error {
  constructor(code, status = 409, { uncertain = false, refund = null } = {}) {
    super({ REFUND_INVALID_REQUEST: 'Envía únicamente un motivo válido y el identificador de solicitud; solo se admite reembolso total.',
      REFUND_NOT_FOUND: 'No se encontró la operación.', REFUND_INELIGIBLE: 'La operación no es elegible para un reembolso total.',
      REFUND_BLOCKED: 'Existe una operación pendiente, incierta o en revisión. No se enviará otro reembolso ni cobro.',
      REFUND_IDEMPOTENCY_CONFLICT: 'El identificador de solicitud ya corresponde a otra operación.',
      REFUND_UNKNOWN: 'El resultado requiere verificación; no vuelvas a solicitar el reembolso.',
      REFUND_NO_EXTERNAL_ID: 'No hay una referencia externa segura para consultar. Se requiere revisión.',
      REFUND_PROVIDER_REJECTED: 'El proveedor rechazó la solicitud. No se aplicó ningún reembolso.',
      REFUND_EXTERNAL_EVIDENCE: 'No se pudo verificar la elegibilidad en el Sandbox. No se envió el reembolso.',
      REFUND_PERSISTENCE: 'No se pudo guardar el resultado. La operación permanece bloqueada para revisión.',
    }[code] || 'La operación requiere revisión segura.');
    this.code = code; this.status = status; this.uncertain = uncertain; this.refund = refund;
  }
}
function normalizeRefund(raw, timeParser) {
  if (!object(raw) || !providerId(raw.id, 're') || !['pending', 'succeeded', 'failed', 'voided'].includes(raw.status)) {
    throw new RefundError('REFUND_UNKNOWN', 502, { uncertain: true });
  }
  const amount = raw.customer_refunded_amount_in_cents, merchant = raw.account_refunded_amount_in_cents;
  if (amount != null && (!Number.isSafeInteger(amount) || amount <= 0 || amount > 9999999999)
    || merchant != null && (!Number.isSafeInteger(merchant) || merchant < 0)
    || raw.currency != null && !/^[A-Z]{3}$/.test(raw.currency)
    || raw.created_at != null && !timeParser(raw.created_at)
    || raw.account_id != null && !providerId(raw.account_id, 'ac')) {
    throw new RefundError('REFUND_UNKNOWN', 502, { uncertain: true, refund: { id: raw.id } });
  }
  // Only documented, allowlisted fields survive. Neither customer nor raw failure text is stored.
  const reason = raw.failure_reason === 'provider_outcome_unknown' ? 'PROVIDER_OUTCOME_UNKNOWN'
    : raw.status === 'failed' ? 'REFUND_PROVIDER_FAILED' : null;
  return { id: raw.id, status: raw.status, amount: amount ?? null, merchantAmount: merchant ?? null,
    currency: raw.currency ?? null, accountId: raw.account_id ?? null,
    time: raw.created_at == null ? null : timeParser(raw.created_at), reason };
}
function inspectRefund(payload, sandboxId, paymentTime) {
  const raw = object(payload.refund) ? payload.refund : {};
  const parent = object(payload.intentable) ? payload.intentable : {};
  const checkout = object(parent.checkout) ? parent.checkout : {};
  const sources = [payload, raw, parent, checkout];
  const modes = sources.filter(n => Object.hasOwn(n, 'live_mode')).map(n => n.live_mode);
  const liveMode = modes.length && modes.every(m => m === modes[0] && typeof m === 'boolean') ? modes[0] : null;
  const info = { eventType: 'refund.create', sourceId: providerId(raw.id, 're') ? raw.id : null,
    environment: liveMode === true ? 'production' : 'sandbox', sandboxId: payload.sandbox_id ?? null, liveMode,
    parentId: providerId(parent.id, 'pa') && parent.type === 'PaymentIntent' ? parent.id : null,
    checkoutId: checkout.id ?? null, checkoutStatus: checkout.status ?? null,
    checkoutAmount: checkout.total_in_cents ?? null, checkoutCurrency: checkout.currency ?? null,
    paymentId: parent.payment?.id ?? checkout.payment?.id ?? null, checkoutPaymentId: checkout.payment?.id ?? null,
    intentId: checkout.latest_intent?.id ?? null, parentAmount: parent.amount_in_cents ?? null, parentCurrency: parent.currency ?? null };
  if (modes.includes(false) && modes.includes(true)) return { ...info, disposition: 'REFUND', code: 'REFUND_ENVIRONMENT_CONFLICT' };
  // The published example lacks environment fields. Do not infer them from a signed delivery or amount.
  if (liveMode !== false || payload.sandbox_id !== sandboxId
    || sources.some(n => n.sandbox_id != null && n.sandbox_id !== sandboxId)) return { ...info, disposition: 'REFUND', code: 'REFUND_ENVIRONMENT_UNPROVEN' };
  try {
    const refund = normalizeRefund(raw, paymentTime);
    if (!info.parentId) return { ...info, disposition: 'REFUND', code: 'REFUND_PARENT_UNPROVEN' };
    return { ...info, externalId: refund.id, disposition: 'REFUND', refund, code: null };
  } catch { return { ...info, disposition: 'REFUND', code: 'REFUND_INVALID_EVIDENCE' }; }
}
module.exports = { object, providerId, HISTORICAL_SUCCESS, RESERVED, RefundError, normalizeRefund, inspectRefund };
