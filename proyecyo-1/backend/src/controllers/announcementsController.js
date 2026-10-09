const {
  listAnnouncements,
  sendAnnouncement,
} = require("../services/announcementsService");

// La identidad sale de la sesion ya validada por requireAdmin (token Bearer).
// Antes se leia la cabecera heredada x-user-id, que el frontend nunca envia:
// cada accion respondia 401 y el cliente cerraba una sesion valida.
function getAdminUserId(req) {
  return Number(req.authUser?.id || 0);
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
      // requireAdmin siempre adjunta authUser; si faltara es un error interno, no una sesion invalida.
      throw new Error("No fue posible identificar al administrador.");
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
