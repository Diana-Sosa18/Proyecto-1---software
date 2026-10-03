const express = require("express");
function mountRecurrenteWebhook(app, handler) {
  if (!handler) return;
  // Call BEFORE express.json(). Svix must receive this original Buffer, not JSON.stringify(req.body).
  // Reject compressed bodies: express must not inflate and change signed bytes.
  app.post("/webhooks/recurrente",
    express.raw({ type: "application/json", limit: "1mb", inflate: false }),
    (req, _res, next) => {
      if (!Buffer.isBuffer(req.body)) {
        return next(Object.assign(new Error("Se requiere application/json para el webhook."), { status: 415 }));
      }
      req.rawBody = req.body;
      next();
    }, handler);
}
module.exports = { mountRecurrenteWebhook };
