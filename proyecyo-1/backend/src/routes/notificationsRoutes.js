const express = require("express");

const {
  getNotifications,
  getUnreadCount,
  patchNotificationRead,
  patchAllNotificationsRead,
} = require("../controllers/notificationsController");

const { requireResident } = require("../middlewares/requireResident");

const router = express.Router();

router.get("/notificaciones", requireResident, getNotifications);
router.get("/notificaciones/no-leidas", requireResident, getUnreadCount);
router.patch("/notificaciones/:id/leida", requireResident, patchNotificationRead);
router.patch("/notificaciones/marcar-todas-leidas", requireResident, patchAllNotificationsRead);

module.exports = router;