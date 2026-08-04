const express = require("express");

const {
  getAdminReminderConfig,
  putAdminReminderConfig,
  generateAdminReminders,
  getAdminReminderSummary,
  getAdminReminders,
} = require("../controllers/adminRemindersController");
const { requireAdmin } = require("../middlewares/requireAdmin");

const router = express.Router();

router.get("/admin/recordatorios/configuracion", requireAdmin, getAdminReminderConfig);
router.put("/admin/recordatorios/configuracion", requireAdmin, putAdminReminderConfig);
router.get("/admin/recordatorios/resumen", requireAdmin, getAdminReminderSummary);
router.post("/admin/recordatorios/generar", requireAdmin, generateAdminReminders);
router.get("/admin/recordatorios", requireAdmin, getAdminReminders);

module.exports = router;
