// Only the documented failure_reason field is inspected. Free text is never
// persisted: classify its meaning into a closed catalogue, discarding card,
// customer, credential and arbitrary provider data even in a signed payload.
function failureReason(value, canceled = false) {
  if (canceled) return { code: "INTENT_CANCELED", message: "El proveedor confirmó la cancelación del intento." };
  const text = typeof value === "string" ? value.slice(0, 4096).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_-]+/g, " ").toLowerCase() : "";
  if (/fondos insuficientes|insufficient funds/.test(text)) {
    return { code: "INSUFFICIENT_FUNDS", message: "El proveedor informó fondos insuficientes." };
  }
  if (/banco.*rechaz|bank.*reject|bank.*declin|card.*declin|tarjeta.*rechaz/.test(text)) {
    return { code: "BANK_DECLINED", message: "El banco rechazó el intento de pago." };
  }
  return { code: "INTENT_FAILED", message: text ? "El proveedor informó un fallo; el texto original se omitió por seguridad."
    : "El proveedor confirmó un intento fallido sin un motivo específico." };
}

function inspectAttempt(payload, info, helpers) {
  const { object, externalId, paymentTime } = helpers;
  const legacy = info.eventType === "payment_intent.failed";
  const canceled = info.eventType === "intent.canceled";
  const state = canceled ? "CANCELADA" : "FALLIDA";
  const checkout = object(payload.checkout) ? payload.checkout : null;
  const latest = object(checkout?.latest_intent) ? checkout.latest_intent : null;
  // The legacy example documents only a pa_* root and checkout.id. Without
  // latest_intent we retain an audited failure in the inbox, but do not invent
  // the canonical in_* transaction or equate the two event formats.
  const canonicalId = legacy ? externalId(latest?.id) : info.sourceId;
  const checkoutId = externalId(checkout?.id);
  const payment = object(payload.payment) ? payload.payment : object(checkout?.payment) ? checkout.payment : null;
  const paymentId = externalId(payment?.id);
  const time = payload.created_at === undefined ? null : paymentTime(payload.created_at);
  const reason = failureReason(legacy ? payload.failure_reason : payload.details?.failure_reason, canceled);
  const reference = checkout?.metadata?.nexus_checkout_reference;
  let code = null;
  if (!info.sourceId || !checkoutId || (legacy && (!/^pa_/.test(info.sourceId)
      || checkout?.status === "paid" || canonicalId && !/^in_/.test(canonicalId)))
    || (!legacy && (!/^in_/.test(canonicalId || "")
    || payload.type !== "payment" || payload.status !== (canceled ? "canceled" : "failed")))
    || (legacy && (payload.type !== undefined && payload.type !== "payment"
      || payload.status !== undefined && payload.status !== "failed"))
    || (Object.hasOwn(checkout || {}, "latest_intent") && (!latest || !canonicalId
      || latest.type !== "PaymentIntent" || externalId(latest.id) !== canonicalId))
    || (checkout?.status !== undefined && !["unpaid", "paid", "payment_in_progress", "expired"].includes(checkout.status))
    || (payload.payment != null && (!object(payload.payment) || !paymentId))
    || (checkout?.payment != null && (!object(checkout.payment) || !externalId(checkout.payment.id)
      || checkout.payment.id !== paymentId))) code = "WEBHOOK_ATTEMPT_INVALID";
  else if (!Number.isSafeInteger(payload.amount_in_cents) || payload.amount_in_cents <= 0
    || payload.amount_in_cents > 9999999999) code = "WEBHOOK_AMOUNT_INVALID";
  else if (checkout?.total_in_cents !== undefined && checkout.total_in_cents !== payload.amount_in_cents) code = "WEBHOOK_AMOUNT_MISMATCH";
  else if (payload.currency !== "GTQ" || checkout?.currency !== undefined && checkout.currency !== "GTQ") code = "WEBHOOK_CURRENCY_MISMATCH";
  else if (payload.created_at !== undefined && !time) code = "WEBHOOK_PAYMENT_DATE_UNTRUSTED";
  if (reference !== undefined && (typeof reference !== "string" || !/^[a-f0-9-]{36}$/i.test(reference))) code = "WEBHOOK_REFERENCE_MISMATCH";
  return { ...info, externalId: canonicalId, checkoutId, paymentId, time, reference,
    amount: payload.amount_in_cents, currency: payload.currency, attemptState: state, reason,
    disposition: code ? "REVISION" : "ATTEMPT", code };
}
module.exports = { failureReason, inspectAttempt };
