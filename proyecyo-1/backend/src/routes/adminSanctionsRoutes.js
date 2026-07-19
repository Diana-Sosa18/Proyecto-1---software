const express = require("express");

const {
  generateAdminSanctions,
  getAdminSanctionRules,
  getAdminSanctionSummary,
  getAdminSanctions,
  patchAdminSanctionStatus,
} = require("../controllers/adminSanctionsController");
const { requireAdmin } = require("../middlewares/requireAdmin");

const router = express.Router();

router.get("/admin/sanciones/resumen", requireAdmin, getAdminSanctionSummary);
router.get("/admin/sanciones/reglas", requireAdmin, getAdminSanctionRules);
router.post("/admin/sanciones/generar", requireAdmin, generateAdminSanctions);
router.patch("/admin/sanciones/:id/estado", requireAdmin, patchAdminSanctionStatus);
router.get("/admin/sanciones", requireAdmin, getAdminSanctions);

module.exports = router;
