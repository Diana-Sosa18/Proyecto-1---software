const express = require("express");

const {
  getScheduleConfig,
  getHouses,
  getPendingSpecialAccesses,
  getSpecialAccessHistory,
  postSpecialAccess,
  patchApproveSpecialAccess,
  patchRejectSpecialAccess,
} = require("../controllers/specialAccessesController");
const { requireAdmin } = require("../middlewares/requireAdmin");

const router = express.Router();

router.get("/admin/accesos-especiales/horario", requireAdmin, getScheduleConfig);
router.get("/admin/accesos-especiales/casas", requireAdmin, getHouses);
router.get("/admin/accesos-especiales/pendientes", requireAdmin, getPendingSpecialAccesses);
router.get("/admin/accesos-especiales/historial", requireAdmin, getSpecialAccessHistory);
router.post("/admin/accesos-especiales", requireAdmin, postSpecialAccess);
router.patch("/admin/accesos-especiales/:id/aprobar", requireAdmin, patchApproveSpecialAccess);
router.patch("/admin/accesos-especiales/:id/rechazar", requireAdmin, patchRejectSpecialAccess);

module.exports = router;
