const {
  getVisitScheduleConfig,
  listHouses,
  listPendingSpecialAccesses,
  listSpecialAccessHistory,
  createSpecialAccess,
  approveSpecialAccess,
  rejectSpecialAccess,
} = require("../services/specialAccessesService");

function getAdminUserId(req) {
  return Number(req.header("x-user-id") || 0);
}

async function getScheduleConfig(_req, res, next) {
  try {
    const schedule = await getVisitScheduleConfig();
    res.status(200).json(schedule);
  } catch (error) {
    next(error);
  }
}

async function getHouses(_req, res, next) {
  try {
    const houses = await listHouses();
    res.status(200).json(houses);
  } catch (error) {
    next(error);
  }
}

async function getPendingSpecialAccesses(_req, res, next) {
  try {
    const accesses = await listPendingSpecialAccesses();
    res.status(200).json(accesses);
  } catch (error) {
    next(error);
  }
}

async function getSpecialAccessHistory(_req, res, next) {
  try {
    const history = await listSpecialAccessHistory();
    res.status(200).json(history);
  } catch (error) {
    next(error);
  }
}

async function postSpecialAccess(req, res, next) {
  try {
    const adminUserId = getAdminUserId(req);

    if (!adminUserId) {
      const error = new Error("No fue posible identificar al administrador.");
      error.status = 401;
      throw error;
    }

    const access = await createSpecialAccess(adminUserId, req.body || {});
    res.status(201).json(access);
  } catch (error) {
    next(error);
  }
}

async function patchApproveSpecialAccess(req, res, next) {
  try {
    const adminUserId = getAdminUserId(req);

    if (!adminUserId) {
      const error = new Error("No fue posible identificar al administrador.");
      error.status = 401;
      throw error;
    }

    const access = await approveSpecialAccess(adminUserId, req.params.id);
    res.status(200).json(access);
  } catch (error) {
    next(error);
  }
}

async function patchRejectSpecialAccess(req, res, next) {
  try {
    const adminUserId = getAdminUserId(req);

    if (!adminUserId) {
      const error = new Error("No fue posible identificar al administrador.");
      error.status = 401;
      throw error;
    }

    const result = await rejectSpecialAccess(adminUserId, req.params.id, req.body || {});
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getScheduleConfig,
  getHouses,
  getPendingSpecialAccesses,
  getSpecialAccessHistory,
  postSpecialAccess,
  patchApproveSpecialAccess,
  patchRejectSpecialAccess,
};
