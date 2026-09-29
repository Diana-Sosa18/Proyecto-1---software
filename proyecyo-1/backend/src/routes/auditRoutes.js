const express = require("express");

const { getAuditLogs } = require("../controllers/auditController");
const { requireAdmin } = require("../middlewares/requireAdmin");

const router = express.Router();
router.get("/admin/auditoria", requireAdmin, getAuditLogs);

module.exports = router;
