const router = require("express").Router();
const controller = require("../controllers/demoRequestsController");
const { requireAdmin } = require("../middlewares/requireAdmin");

router.post("/public/solicitudes-demo", controller.create);
router.get("/admin/solicitudes-demo", requireAdmin, controller.list);
router.get("/admin/solicitudes-demo/:id", requireAdmin, controller.detail);
router.patch("/admin/solicitudes-demo/:id/estado", requireAdmin, controller.updateStatus);

module.exports = router;
