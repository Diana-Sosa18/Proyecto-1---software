const express = require("express");

const {
  getRestoreHistory,
  postRestoreBackup,
  postValidateBackup,
} = require("../controllers/restoresController");
const { requireAdmin } = require("../middlewares/requireAdmin");

const router = express.Router();

router.get("/admin/restauraciones", requireAdmin, getRestoreHistory);
router.post("/admin/restauraciones/validar", requireAdmin, postValidateBackup);
router.post("/admin/restauraciones", requireAdmin, postRestoreBackup);

module.exports = router;
