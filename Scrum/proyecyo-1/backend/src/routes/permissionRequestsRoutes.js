const express = require("express");

const {
  postPermissionRequest,
  getOwnPermissionRequests,
  patchCancelPermissionRequest,
} = require("../controllers/permissionRequestsController");

const router = express.Router();

router.post("/solicitudes-permiso", postPermissionRequest);
router.get("/solicitudes-permiso/mias", getOwnPermissionRequests);
router.patch("/solicitudes-permiso/:id/cancelar", patchCancelPermissionRequest);

module.exports = router;