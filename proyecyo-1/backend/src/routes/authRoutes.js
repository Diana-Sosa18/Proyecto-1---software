const express = require("express");

const { login, logout, session } = require("../controllers/authController");

const router = express.Router();

router.post("/login", login);
router.post("/auth/logout", logout);
router.get("/auth/session", session);

module.exports = router;
