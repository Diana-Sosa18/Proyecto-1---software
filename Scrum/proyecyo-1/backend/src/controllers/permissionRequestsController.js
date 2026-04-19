const {
  createPermissionRequest,
  listOwnPermissionRequests,
  cancelPermissionRequest,
} = require("../services/permissionRequestsService");

async function postPermissionRequest(req, res, next) {
  try {
    const userId = Number(req.header("x-user-id"));
    const data = await createPermissionRequest(userId, req.body || {});
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
}

async function getOwnPermissionRequests(req, res, next) {
  try {
    const userId = Number(req.header("x-user-id"));
    const data = await listOwnPermissionRequests(userId);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
}

async function patchCancelPermissionRequest(req, res, next) {
  try {
    const userId = Number(req.header("x-user-id"));
    const data = await cancelPermissionRequest(userId, req.params.id);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  postPermissionRequest,
  getOwnPermissionRequests,
  patchCancelPermissionRequest,
};