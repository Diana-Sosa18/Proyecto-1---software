const express = require("express");

const {
  getAdminDailyAccessSummary,
  getAdminHourlyAccessChart,
  getAdminDailyAccessChart,
  getAdminAccesses,
} = require("../controllers/adminAccessesController");
const { requireAdmin } = require("../middlewares/requireAdmin");

const router = express.Router();

router.get("/admin/accesos/resumen", requireAdmin, getAdminDailyAccessSummary);
router.get("/admin/accesos/grafica-horas", requireAdmin, getAdminHourlyAccessChart);
// SCRUM-171/173: endpoint para grafica diaria (ultimos 7 dias)
router.get("/admin/accesos/grafica-dias", requireAdmin, getAdminDailyAccessChart);
router.get("/admin/accesos", requireAdmin, getAdminAccesses);

module.exports = router;
