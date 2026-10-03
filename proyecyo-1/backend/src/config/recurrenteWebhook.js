const { env } = require("./env");

function getWebhookConfig(source = env) {
  const secret = String(source.RECURRENTE_WEBHOOK_SECRET || "").trim();
  const sandboxId = String(source.RECURRENTE_SANDBOX_ID || "").trim();
  if (!/^whsec_[A-Za-z0-9+/]+={0,2}$/.test(secret) || !/^sbx_[A-Za-z0-9_-]+$/.test(sandboxId)) {
    throw Object.assign(new Error("Webhook no configurado."), { code: "WEBHOOK_UNAVAILABLE", status: 503 });
  }
  const config = { sandboxId, environment: "sandbox" };
  Object.defineProperty(config, "secret", { value: secret, enumerable: false });
  return Object.freeze(config);
}
module.exports = { getWebhookConfig };
