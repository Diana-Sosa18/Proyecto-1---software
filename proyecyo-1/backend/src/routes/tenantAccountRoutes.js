const express = require("express");

const { getTenantAccountStatement } = require("../controllers/tenantAccountController");
const { requireTenant } = require("../middlewares/requireResident");

const router = express.Router();

router.get("/inquilino/estado-cuenta", requireTenant, getTenantAccountStatement);

module.exports = router;
