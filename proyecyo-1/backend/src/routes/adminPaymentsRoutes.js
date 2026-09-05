const express = require("express");

const { getAdminPayments } = require("../controllers/adminPaymentsController");
const { requireAdmin } = require("../middlewares/requireAdmin");

const router = express.Router();

router.get("/admin/pagos", requireAdmin, getAdminPayments);

module.exports = router;
