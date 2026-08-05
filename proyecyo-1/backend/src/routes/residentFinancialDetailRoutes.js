const express = require("express");

const {
  getResidentFinancialDetail,
} = require("../controllers/residentFinancialDetailController");
const { requireResident } = require("../middlewares/requireResident");

const router = express.Router();

router.get("/residente/detalle-financiero", requireResident, getResidentFinancialDetail);

module.exports = router;
