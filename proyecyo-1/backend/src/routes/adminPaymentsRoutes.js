const express = require("express");

const { getAdminPayments, getMonthlyReport, getRecentPayments } = require("../controllers/adminPaymentsController");
const { requireAdmin } = require("../middlewares/requireAdmin");

const router = express.Router();

router.get("/admin/pagos", requireAdmin, getAdminPayments);
router.get("/admin/pagos/recientes", requireAdmin, getRecentPayments);
router.get("/admin/reportes/financiero-mensual", requireAdmin, getMonthlyReport);

module.exports = router;
