const {
  getAdminAccessSummary,
  listAdminAccesses,
} = require("../services/adminAccessesService");

async function getAdminDailyAccessSummary(_req, res, next) {
  try {
    const summary = await getAdminAccessSummary();
    res.status(200).json(summary);
  } catch (error) {
    next(error);
  }
}

async function getAdminAccesses(req, res, next) {
  try {
    const accesses = await listAdminAccesses(req.query || {});
    res.status(200).json(accesses);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAdminDailyAccessSummary,
  getAdminAccesses,
};
