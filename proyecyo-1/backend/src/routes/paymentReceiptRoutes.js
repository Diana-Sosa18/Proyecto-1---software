const express = require("express");
const { downloadPaymentReceipt } = require("../controllers/paymentReceiptController");
const { requireResident, requireTenant } = require("../middlewares/requireResident");
const router = express.Router();
router.get("/residente/pagos/:paymentId/comprobante", requireResident, downloadPaymentReceipt);
router.get("/inquilino/pagos/:paymentId/comprobante", requireTenant, downloadPaymentReceipt);
module.exports = router;
