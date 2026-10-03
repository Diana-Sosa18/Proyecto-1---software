const REDACTED = "[REDACTED]";
const sensitiveKey = /secret|authorization|password|cookie|token|api.?key|x.?secret.?key|recurrente|pan|cvc|cvv|card|tarjeta|body|payload|request|response|config/i;
function sanitizeText(value) {
  let text = String(value);
  for (const [key, secret] of Object.entries(process.env)) {
    if (/secret|password|token|api.?key|recurrente/i.test(key) && secret) text = text.split(secret).join(REDACTED);
  }
  return text
    .replace(/(Authorization["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\r\n,;}]+)/gi, `$1${REDACTED}`)
    .replace(/\bBearer\s+[^\s,"'}]+/gi, `Bearer ${REDACTED}`)
    .replace(/((?:X-SECRET-KEY|RECURRENTE_SECRET_KEY|RECURRENTE_WEBHOOK_SECRET|password|cvc|cvv|pan)["']?\s*[:=]\s*)["']?[^\s,;}]+/gi, `$1${REDACTED}`)
    .replace(/\b(?:\d[ -]?){13,19}\b/g, REDACTED)
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, `$1${REDACTED}@`);
}
function sanitize(value, seen = new WeakSet(), depth = 0) {
  if (typeof value === "string") return sanitizeText(value);
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value !== "object") return "[UNSUPPORTED]";
  if (Buffer.isBuffer(value) || ArrayBuffer.isView(value)) return REDACTED;
  if (depth > 8) return "[TRUNCATED]";
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);
  if (value instanceof Error) {
    // Do not serialize SDK request/response/stack or arbitrary properties.
    return { name: sanitizeText(value.name), message: sanitizeText(value.message),
      ...(value.code ? { code: sanitizeText(value.code) } : {}),
      ...(value.status ? { status: value.status } : {}) };
  }
  if (Array.isArray(value)) return value.map((entry) => sanitize(entry, seen, depth + 1));
  const result = {};
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    result[key] = sensitiveKey.test(key) ? REDACTED
      : "value" in descriptor ? sanitize(descriptor.value, seen, depth + 1) : "[ACCESSOR]";
  }
  return result;
}
const logger = Object.fromEntries(["info", "warn", "error"].map((level) => [level,
  (...args) => console[level](...args.map((arg) => sanitize(arg)))]));
module.exports = { logger, sanitize, sanitizeText };
