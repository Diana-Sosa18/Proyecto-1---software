const { listAdminAccesses } = require("../services/adminAccessesService");

async function getAdminAccesses(req, res, next) {
  try {
    const accesses = await listAdminAccesses({
      estado: req.query.estado,
    });

    res.status(200).json(accesses);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAdminAccesses,
};