const { getWebhookConfig } = require("../config/recurrenteWebhook");
const { verifyWebhook, inspectEvent } = require("../services/recurrenteWebhookPayload");
const { createWebhookService } = require("../services/recurrenteWebhookService");

function createWebhookHandler({ configuration = getWebhookConfig, service = createWebhookService() } = {}) {
  return async (req, res) => {
    try {
      const config = configuration();
      const verified = verifyWebhook(req.rawBody, req.headers, config);
      const event = inspectEvent(verified.payload, config.sandboxId);
      const result = await service.receive({ ...verified, payload: undefined, event, sandboxId: config.sandboxId });
      res.status(200).json({ received: true, result });
    } catch (error) {
      // Never propagate SQL, SDK, payload, signature headers or credentials to logs
      // or clients. Codes below are locally generated, not taken from remote bodies.
      const safeCodes = new Set(["WEBHOOK_UNAVAILABLE", "WEBHOOK_INVALID_SIGNATURE", "WEBHOOK_INVALID_PAYLOAD",
        "WEBHOOK_AMBIGUOUS_PAYLOAD", "WEBHOOK_RAW_BODY_REQUIRED", "WEBHOOK_EVENT_CONFLICT", "WEBHOOK_CHECKOUT_NOT_READY", "WEBHOOK_RETRY"]);
      const code = safeCodes.has(error.code) ? error.code : "WEBHOOK_RETRY";
      const status = code === "WEBHOOK_RETRY" ? 503 : error.status || 503;
      res.status(status).json({ code, message: status >= 500 ? "Webhook temporalmente no disponible."
        : "Webhook no aceptado." });
    }
  };
}
module.exports = { createWebhookHandler };
