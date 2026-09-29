const express = require("express");

const { deleteActiveSession, getActiveSessions } = require("../controllers/activeSessionsController");
const { requireRoles } = require("../middlewares/requireRoles");

const router = express.Router();
const requireUser = requireRoles(["admin", "guardia", "residente", "inquilino"]);

router.get("/auth/sessions", requireUser, getActiveSessions);
router.delete("/auth/sessions/:sessionId", requireUser, deleteActiveSession);

module.exports = router;
