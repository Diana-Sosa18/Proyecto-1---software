const express = require("express");

const {
  getNotifications,
  getUnreadCount,
  patchNotificationRead,
  patchAllNotificationsRead,
} = require("../controllers/notificationsController");

const { requireNotificationUser } = require("../middlewares/requireNotificationUser");

const router = express.Router();

router.get("/notificaciones", requireNotificationUser, getNotifications);
router.get("/notificaciones/no-leidas", requireNotificationUser, getUnreadCount);
router.patch("/notificaciones/:id/leida", requireNotificationUser, patchNotificationRead);
router.patch("/notificaciones/marcar-todas-leidas", requireNotificationUser, patchAllNotificationsRead);

module.exports = router;