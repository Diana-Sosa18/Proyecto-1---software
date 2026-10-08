const express = require("express");

const { getHouses, getHouse, postHouse, putHouse, patchHouseActive } = require("../controllers/housesController");
const { requireAdmin } = require("../middlewares/requireAdmin");

const router = express.Router();

// GET /admin/viviendas admite ?q=&estado=DISPONIBLE|OCUPADA y, para el selector
// de usuarios, ?seleccion=residente|inquilino&id_usuario= (elegibilidad informativa).
router.get("/admin/viviendas", requireAdmin, getHouses);
router.get("/admin/viviendas/:id", requireAdmin, getHouse);
router.post("/admin/viviendas", requireAdmin, postHouse);
router.put("/admin/viviendas/:id", requireAdmin, putHouse);
router.patch("/admin/viviendas/:id/activo", requireAdmin, patchHouseActive);

module.exports = router;
