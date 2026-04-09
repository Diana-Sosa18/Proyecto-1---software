const express = require("express");

const { getUserTypes } = require("../controllers/userTypesController");
const { requireAdmin } = require("../middlewares/requireAdmin");

const router = express.Router();

router.get("/tipos-usuario", requireAdmin, getUserTypes);

module.exports = router;
