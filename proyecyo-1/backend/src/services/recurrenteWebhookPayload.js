const { createHash } = require("node:crypto");
const { isUtf8 } = require("node:buffer");
const { Webhook } = require("svix");

const object = (v) => v && typeof v === "object" && !Array.isArray(v);
const externalId = (v) => typeof v === "string" && /^[A-Za-z0-9_-]{1,191}$/.test(v) ? v : null;
function safeError(code, status = 400) {
  return Object.assign(new Error("Solicitud de webhook no aceptada."), { code, status });
}
function verifyWebhook(rawBody, headers, config) {
  if (!Buffer.isBuffer(rawBody)) throw safeError("WEBHOOK_RAW_BODY_REQUIRED", 415);
  if (!isUtf8(rawBody)) throw safeError("WEBHOOK_INVALID_SIGNATURE", 401);
  const selected = {};
  for (const key of ["svix-id", "svix-timestamp", "svix-signature"]) {
    if (typeof headers[key] !== "string" || !headers[key]) throw safeError("WEBHOOK_INVALID_SIGNATURE", 401);
    selected[key] = headers[key];
  }
  if (!externalId(selected["svix-id"]) || !/^\d{1,12}$/.test(selected["svix-timestamp"])) {
    throw safeError("WEBHOOK_INVALID_SIGNATURE", 401);
  }
  // The official verifier checks HMAC and its five-minute delivery timestamp window
  // before parsing JSON. No reserialization, timestamp bypass or provider API call.
  let verifier;
  try { verifier = new Webhook(config.secret); }
  catch { throw safeError("WEBHOOK_UNAVAILABLE", 503); }
  let payload;
  try { verifier.verify(rawBody, selected); }
  catch (error) {
    // Svix 1.x parses JSON only after authenticating its signature; distinguish
    // a signed malformed JSON body from a failed cryptographic verification.
    if (error instanceof SyntaxError) throw safeError("WEBHOOK_INVALID_PAYLOAD");
    throw safeError("WEBHOOK_INVALID_SIGNATURE", 401);
  }
  try { payload = JSON.parse(rawBody.toString("utf8")); }
  catch { throw safeError("WEBHOOK_INVALID_PAYLOAD"); }
  if (!object(payload)) throw safeError("WEBHOOK_INVALID_PAYLOAD");
  // Also accept the documented Svix event envelope; never mix two financial bodies.
  if (object(payload.data) && payload.data.event_type !== undefined) {
    if (payload.event_type !== undefined) throw safeError("WEBHOOK_AMBIGUOUS_PAYLOAD");
    payload = payload.data;
  }
  return { payload, svixId: selected["svix-id"], hash: createHash("sha256").update(rawBody).digest("hex") };
}

function paymentTime(value) {
  // Explicit timezone required. Reject JS Date's normalization of invalid calendar
  // dates, date-only values, missing offsets and excess sub-microsecond precision.
  const match = typeof value === "string" && /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d, h, min, s, fraction = "", offset] = match;
  const year = Number(y), month = Number(m), day = Number(d);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (year < 1000 || year > 9999 || calendar.getUTCFullYear() !== year
    || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day
    || Number(h) > 23 || Number(min) > 59 || Number(s) > 59
    || (offset !== "Z" && (Number(offset.slice(1, 3)) > 14 || Number(offset.slice(4)) > 59
      || (Number(offset.slice(1, 3)) === 14 && Number(offset.slice(4)) !== 0)))) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() < 1000 || date.getUTCFullYear() > 9999) return null;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Guatemala", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type) => parts.find((p) => p.type === type).value;
  return { original: value, utc: `${date.toISOString().slice(0, 19).replace("T", " ")}.${fraction.padEnd(6, "0")}`,
    accountingDate: `${part("year")}-${part("month")}-${part("day")}` };
}

function inspectEvent(payload, sandboxId) {
  const eventType = typeof payload.event_type === "string" && /^[a-z0-9_.-]{1,100}$/.test(payload.event_type)
    ? payload.event_type : "invalid";
  const checkout = object(payload.checkout) ? payload.checkout : null;
  // Resolve only the signed locations observed from Recurrente. Every supplied
  // value must be a boolean and agree; a false value cannot hide a true one.
  const modes = [payload, checkout].filter((node) => node && Object.hasOwn(node, "live_mode"))
    .map((node) => node.live_mode);
  const liveMode = modes.length && modes.every((mode) => typeof mode === "boolean" && mode === modes[0]) ? modes[0] : null;
  const sourceId = externalId(payload.id);
  const info = { eventType, sourceId, externalId: sourceId,
    environment: modes.includes(true) ? "production" : "sandbox",
    sandboxId: externalId(payload.sandbox_id), liveMode };
  if (liveMode !== false || payload.sandbox_id !== sandboxId
    || (checkout && Object.hasOwn(checkout, "sandbox_id") && checkout.sandbox_id !== sandboxId)) {
    return { ...info, disposition: "IGNORADO", code: "WEBHOOK_ENVIRONMENT_MISMATCH" };
  }
  const paymentIntent = eventType === "payment_intent.succeeded";
  if ((!paymentIntent && eventType !== "intent.succeeded")
    || (!paymentIntent && payload.type !== "payment")
    || (paymentIntent && payload.type !== undefined && payload.type !== "payment")) {
    return { ...info, disposition: "IGNORADO", code: "WEBHOOK_UNSUPPORTED_EVENT" };
  }
  const checkoutId = externalId(checkout?.id);
  const latest = object(checkout?.latest_intent) ? checkout.latest_intent : null;
  // The two root IDs are different operations. The signed latest_intent ID and
  // payment ID are shared by both deliveries and identify one financial payment.
  const canonicalId = paymentIntent ? externalId(latest?.id) : sourceId;
  const payment = object(payload.payment) ? payload.payment : object(checkout?.payment) ? checkout.payment : null;
  const paymentId = externalId(payment?.id);
  const time = paymentTime(payload.created_at);
  let code = null;
  if (!sourceId || !canonicalId || !checkoutId
    || (!paymentIntent && payload.status !== "succeeded")
    || (paymentIntent && (checkout?.status !== "paid" || !paymentId
      || latest?.type !== "PaymentIntent" || (payload.status !== undefined && payload.status !== "succeeded")
      || (payload.failure_reason !== undefined && payload.failure_reason !== null)))
    || (checkout?.status !== undefined && checkout.status !== "paid")
    || (Object.hasOwn(checkout || {}, "latest_intent") && (!latest || externalId(latest.id) !== canonicalId
      || latest.type !== "PaymentIntent"))
    || (payload.payment != null && (!object(payload.payment) || !externalId(payload.payment.id)))
    || (checkout?.payment != null && (!object(checkout.payment) || !externalId(checkout.payment.id)
      || checkout.payment.id !== paymentId))) code = "WEBHOOK_PAYMENT_INVALID";
  else if (!Number.isSafeInteger(payload.amount_in_cents) || payload.amount_in_cents <= 0) code = "WEBHOOK_AMOUNT_INVALID";
  else if (payload.amount_in_cents > 9999999999) code = "WEBHOOK_AMOUNT_STORAGE_LIMIT";
  else if (checkout?.total_in_cents !== undefined && (!Number.isSafeInteger(checkout.total_in_cents)
    || checkout.total_in_cents !== payload.amount_in_cents)) code = "WEBHOOK_AMOUNT_MISMATCH";
  else if (payload.currency !== "GTQ" || (checkout?.currency !== undefined && checkout.currency !== payload.currency)) code = "WEBHOOK_CURRENCY_MISMATCH";
  else if (!time) code = "WEBHOOK_PAYMENT_DATE_UNTRUSTED";
  const reference = checkout?.metadata?.nexus_checkout_reference;
  if (reference !== undefined && (typeof reference !== "string" || !/^[a-f0-9-]{36}$/i.test(reference))) code = "WEBHOOK_REFERENCE_MISMATCH";
  return { ...info, externalId: canonicalId, disposition: code ? "REVISION" : "PAYMENT", code, checkoutId,
    amount: payload.amount_in_cents, currency: payload.currency, time,
    paymentId, reference };
}
module.exports = { verifyWebhook, inspectEvent, paymentTime, safeError };
