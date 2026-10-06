const {
  listNotifications,
  listNotificationsPage,
  countUnreadNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} = require("../services/notificationsService");

async function getNotifications(req, res, next) {
  try {
    const notifications = await listNotifications(req.authUser.id);
    res.status(200).json(notifications);
  } catch (error) {
    next(error);
  }
}

async function getNotificationsPage(req, res, next) {
  try {
    const page = await listNotificationsPage(req.authUser.id, {
      filtro: req.query.filtro,
      cursor: req.query.cursor,
      limit: req.query.limit,
    });
    res.status(200).json(page);
  } catch (error) {
    next(error);
  }
}

async function getUnreadCount(req, res, next) {
  try {
    const unread = await countUnreadNotifications(req.authUser.id);
    res.status(200).json({ unread });
  } catch (error) {
    next(error);
  }
}

async function patchNotificationRead(req, res, next) {
  try {
    const notification = await markNotificationAsRead(req.authUser.id, req.params.id);
    res.status(200).json(notification);
  } catch (error) {
    next(error);
  }
}

async function patchAllNotificationsRead(req, res, next) {
  try {
    const result = await markAllNotificationsAsRead(req.authUser.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getNotifications,
  getNotificationsPage,
  getUnreadCount,
  patchNotificationRead,
  patchAllNotificationsRead,
};