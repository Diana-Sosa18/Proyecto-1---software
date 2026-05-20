const express = require("express");

const {
  getNotifications,
  getUnreadCount,
  patchNotificationRead,
  patchAllNotificationsRead,
} = require("../controllers/notificationsController");

const { requireResident } = require("../middlewares/requireResident");
const { requireGuard } = require("../middlewares/requireGuard");

const router = express.Router();

// Notificaciones para residentes
router.get("/notificaciones", requireResident, getNotifications);
router.get("/notificaciones/no-leidas", requireResident, getUnreadCount);
router.patch("/notificaciones/:id/leida", requireResident, patchNotificationRead);
router.patch("/notificaciones/marcar-todas-leidas", requireResident, patchAllNotificationsRead);

// SCRUM-179: Notificaciones para guardias (sistema de alertas)
router.get("/guardia/notificaciones", requireGuard, getNotifications);
router.get("/guardia/notificaciones/no-leidas", requireGuard, getUnreadCount);
router.patch("/guardia/notificaciones/:id/leida", requireGuard, patchNotificationRead);
router.patch("/guardia/notificaciones/marcar-todas-leidas", requireGuard, patchAllNotificationsRead);

module.exports = router;