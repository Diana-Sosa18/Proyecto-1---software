const express = require("express");
const { requireResidentSession } = require("../middlewares/requireResidentSession");
const { checkoutController, statusController, retryController } = require("../controllers/recurrenteCheckoutController");
const { createCheckoutService } = require("../services/recurrenteCheckoutService");
function recurrenteCheckoutRoutes(service = createCheckoutService()) {
  const router = express.Router();
  router.post("/residente/pagos/recurrente/checkout", requireResidentSession, checkoutController(service));
  router.get("/residente/pagos/recurrente/checkouts/:reference", requireResidentSession, statusController(service));
  router.post("/residente/pagos/recurrente/reintentar", requireResidentSession, retryController(service));
  return router;
}
module.exports = { recurrenteCheckoutRoutes };
