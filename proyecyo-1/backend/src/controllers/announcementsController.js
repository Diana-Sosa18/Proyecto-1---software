const {
  listAnnouncements,
  sendAnnouncement,
} = require("../services/announcementsService");

function getAdminUserId(req) {
  return Number(req.header("x-user-id") || 0);
}

async function getAnnouncements(_req, res, next) {
  try {
    const announcements = await listAnnouncements();
    res.status(200).json(announcements);
  } catch (error) {
    next(error);
  }
}

async function postAnnouncement(req, res, next) {
  try {
    const adminUserId = getAdminUserId(req);

    if (!adminUserId) {
      const error = new Error("No fue posible identificar al administrador.");
      error.status = 401;
      throw error;
    }

    const announcement = await sendAnnouncement(adminUserId, req.body || {});
    res.status(201).json(announcement);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAnnouncements,
  postAnnouncement,
};
