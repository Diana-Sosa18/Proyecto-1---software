const express = require("express");
const { requireResidentSession } = require("../middlewares/requireResidentSession");
const { checkoutController } = require("../controllers/recurrenteCheckoutController");
const { createCheckoutService } = require("../services/recurrenteCheckoutService");
function recurrenteCheckoutRoutes(service = createCheckoutService()) {
  const router = express.Router();
  router.post("/residente/pagos/recurrente/checkout", requireResidentSession, checkoutController(service));
  return router;
}
module.exports = { recurrenteCheckoutRoutes };
