const express = require("express");

const {
  getTenantProviders,
  postTenantProvider,
  patchTenantProvider,
} = require("../controllers/tenantProvidersController");
const { requireResidentOrTenant } = require("../middlewares/requireResident");

const router = express.Router();

router.get("/inquilino/proveedores", requireResidentOrTenant, getTenantProviders);
router.post("/inquilino/proveedores", requireResidentOrTenant, postTenantProvider);
router.patch("/inquilino/proveedores/:id", requireResidentOrTenant, patchTenantProvider);

module.exports = router;
