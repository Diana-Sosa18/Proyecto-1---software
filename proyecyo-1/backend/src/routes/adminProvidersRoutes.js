const express = require("express");

const {
  getAdminProviders,
  getAdminProvidersHistory,
  patchAdminProvider,
} = require("../controllers/adminProvidersController");
const { requireAdmin } = require("../middlewares/requireAdmin");

const router = express.Router();

router.get("/admin/proveedores", requireAdmin, getAdminProviders);
router.get("/admin/proveedores/historial", requireAdmin, getAdminProvidersHistory);
router.patch("/admin/proveedores/:id", requireAdmin, patchAdminProvider);

module.exports = router;
