const express = require("express");

const { login, session } = require("../controllers/authController");

const router = express.Router();

router.post("/login", login);
router.get("/auth/session", session);

module.exports = router;
