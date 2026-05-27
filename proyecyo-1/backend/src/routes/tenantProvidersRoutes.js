const express = require("express");

const {
  getTenantProviders,
  getTenantProviderHistory,
  getOwnerProviders,
  postTenantProvider,
  patchTenantProvider,
  patchOwnerProvider,
} = require("../controllers/tenantProvidersController");
const { requireResident, requireResidentOrTenant } = require("../middlewares/requireResident");

const router = express.Router();

router.get("/inquilino/proveedores", requireResidentOrTenant, getTenantProviders);
router.get("/inquilino/proveedores/historial", requireResidentOrTenant, getTenantProviderHistory);
router.post("/inquilino/proveedores", requireResidentOrTenant, postTenantProvider);
router.patch("/inquilino/proveedores/:id", requireResidentOrTenant, patchTenantProvider);
router.get("/residente/proveedores", requireResident, getOwnerProviders);
router.patch("/residente/proveedores/:id", requireResident, patchOwnerProvider);

module.exports = router;
