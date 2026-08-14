const express = require("express");

const {
  downloadResidentPaymentReceipt,
} = require("../controllers/residentPaymentReceiptController");
const { requireResident } = require("../middlewares/requireResident");

const router = express.Router();

router.get(
  "/residente/pagos/:paymentId/comprobante",
  requireResident,
  downloadResidentPaymentReceipt,
);

module.exports = router;
