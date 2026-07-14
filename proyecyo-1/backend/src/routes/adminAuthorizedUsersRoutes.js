const express = require("express");

const { getAuthorizedUsers } = require("../controllers/adminAuthorizedUsersController");
const { requireAdmin } = require("../middlewares/requireAdmin");

const router = express.Router();

router.get("/admin/usuarios-autorizados", requireAdmin, getAuthorizedUsers);

module.exports = router;
