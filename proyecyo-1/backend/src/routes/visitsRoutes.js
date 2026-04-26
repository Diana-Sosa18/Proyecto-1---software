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
const { requireResidentOrTenant } = require("../middlewares/requireResident");
const { requireGuard } = require("../middlewares/requireGuard");

const router = express.Router();

router.get("/visitas", requireResidentOrTenant, getVisits);
router.get("/visitantes-frecuentes", requireResidentOrTenant, getFrequentVisitors);
router.delete("/visitantes-frecuentes/:id", requireResidentOrTenant, removeFrequentVisitor);
router.post("/visitas", requireResidentOrTenant, postVisit);
router.delete("/visitas/:id", requireResidentOrTenant, removeVisit);
router.get("/guardia/visitas", requireGuard, getGuardVisits);
router.post("/guardia/validar-qr", requireGuard, postValidateQr);
router.post("/guardia/registrar-ingreso", requireGuard, postRegisterQrEntry);

module.exports = router;
