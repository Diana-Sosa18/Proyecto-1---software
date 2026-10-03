const { env } = require("./env");
const { CheckoutError } = require("../services/recurrenteCheckoutErrors");
const API_BASE = "https://app.recurrente.com/api";

function getCheckoutConfig(source = env) {
  const key = String(source.RECURRENTE_SECRET_KEY || "").trim();
  const sandboxId = String(source.RECURRENTE_SANDBOX_ID || "").trim();
  if (!key || /[\r\n]/.test(key) || !/^sbx_[A-Za-z0-9_-]+$/.test(sandboxId) || sandboxId.length > 191) {
    throw new CheckoutError("CHECKOUT_NOT_CONFIGURED");
  }
  let origin;
  try {
    const url = new URL(source.FRONTEND_ORIGIN);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password
      || url.search || url.hash || url.pathname !== "/") throw new Error();
    origin = url.origin;
  } catch { throw new CheckoutError("CHECKOUT_NOT_CONFIGURED"); }
  const config = { sandboxId, apiBase: API_BASE, origin, timeoutMs: 10000 };
  Object.defineProperty(config, "secretKey", { value: key, enumerable: false });
  return Object.freeze(config);
}
module.exports = { API_BASE, getCheckoutConfig };
