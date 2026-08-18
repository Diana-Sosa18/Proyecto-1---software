const express = require("express");

const { getResidentAccountStatement } = require("../controllers/residentAccountController");
const { requireResident } = require("../middlewares/requireResident");
const { postSimulatedPayment } = require("../controllers/simulatedPaymentsController");

const router = express.Router();

router.get("/residente/estado-cuenta", requireResident, getResidentAccountStatement);
router.post("/residente/pagos-simulados", requireResident, postSimulatedPayment);

module.exports = router;
