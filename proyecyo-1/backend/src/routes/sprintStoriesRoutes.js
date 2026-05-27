const express = require("express");

const {
  getTenantPermissions,
  getTenantAuthorizationRequests,
  postTenantAuthorizationRequest,
  getResidentRegulations,
  getGuardAccessHistory,
} = require("../controllers/sprintStoriesController");
const { requireGuard } = require("../middlewares/requireGuard");
const { requireResident, requireResidentOrTenant } = require("../middlewares/requireResident");

const router = express.Router();

router.get("/inquilino/permisos", requireResidentOrTenant, getTenantPermissions);
router.get("/inquilino/autorizaciones", requireResidentOrTenant, getTenantAuthorizationRequests);
router.post("/inquilino/autorizaciones", requireResidentOrTenant, postTenantAuthorizationRequest);
router.get("/residente/reglamentos", requireResident, getResidentRegulations);
router.get("/guardia/historial-accesos", requireGuard, getGuardAccessHistory);

module.exports = router;
