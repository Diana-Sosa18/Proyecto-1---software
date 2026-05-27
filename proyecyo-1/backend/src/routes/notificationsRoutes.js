const express = require("express");

const {
  getNotifications,
  getUnreadCount,
  patchNotificationRead,
  patchAllNotificationsRead,
} = require("../controllers/notificationsController");

const { requireGuard } = require("../middlewares/requireGuard");
const { requireNotificationUser } = require("../middlewares/requireNotificationUser");

const router = express.Router();

router.get("/notificaciones", requireNotificationUser, getNotifications);
router.get("/notificaciones/no-leidas", requireNotificationUser, getUnreadCount);
router.patch("/notificaciones/:id/leida", requireNotificationUser, patchNotificationRead);
router.patch("/notificaciones/marcar-todas-leidas", requireNotificationUser, patchAllNotificationsRead);

// SCRUM-179: Notificaciones para guardias (sistema de alertas)
router.get("/guardia/notificaciones", requireGuard, getNotifications);
router.get("/guardia/notificaciones/no-leidas", requireGuard, getUnreadCount);
router.patch("/guardia/notificaciones/:id/leida", requireGuard, patchNotificationRead);
router.patch("/guardia/notificaciones/marcar-todas-leidas", requireGuard, patchAllNotificationsRead);

module.exports = router;
