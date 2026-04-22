const express = require("express");

const {
  getAdminDailyAccessSummary,
  getAdminAccesses,
} = require("../controllers/adminAccessesController");
const { requireAdmin } = require("../middlewares/requireAdmin");

const router = express.Router();

router.get("/admin/accesos/resumen", requireAdmin, getAdminDailyAccessSummary);
router.get("/admin/accesos", requireAdmin, getAdminAccesses);

module.exports = router;
