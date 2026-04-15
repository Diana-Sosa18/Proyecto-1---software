const express = require("express");

const {
  getVisits,
  getFrequentVisitors,
  postVisit,
  removeVisit,
  removeFrequentVisitor,
  getGuardVisits,
  postValidateQr,
  postRegisterQrEntry,
} = require("../controllers/visitsController");
const { requireResident } = require("../middlewares/requireResident");
const { requireGuard } = require("../middlewares/requireGuard");

const router = express.Router();

router.get("/visitas", requireResident, getVisits);
router.get("/visitantes-frecuentes", requireResident, getFrequentVisitors);
router.delete("/visitantes-frecuentes/:id", requireResident, removeFrequentVisitor);
router.post("/visitas", requireResident, postVisit);
router.delete("/visitas/:id", requireResident, removeVisit);
router.get("/guardia/visitas", requireGuard, getGuardVisits);
router.post("/guardia/validar-qr", requireGuard, postValidateQr);
router.post("/guardia/registrar-ingreso", requireGuard, postRegisterQrEntry);

module.exports = router;
