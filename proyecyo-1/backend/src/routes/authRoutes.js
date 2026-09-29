const express = require("express");

const { login, logout, session } = require("../controllers/authController");
const { changeForgottenPassword, forgotPassword } = require("../controllers/passwordResetController");

const router = express.Router();

router.post("/login", login);
router.post("/auth/logout", logout);
router.get("/auth/session", session);
router.post("/auth/password/forgot", forgotPassword);
router.post("/auth/password/reset", changeForgottenPassword);

module.exports = router;
