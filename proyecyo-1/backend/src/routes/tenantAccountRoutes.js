const express = require("express");

const { getTenantAccountStatement } = require("../controllers/tenantAccountController");
const { requireTenant } = require("../middlewares/requireResident");
const { postSimulatedPayment } = require("../controllers/simulatedPaymentsController");

const router = express.Router();

router.get("/inquilino/estado-cuenta", requireTenant, getTenantAccountStatement);
router.get("/inquilino/historial-financiero", requireTenant, getTenantAccountStatement);
router.post("/inquilino/pagos-simulados", requireTenant, postSimulatedPayment);

module.exports = router;
