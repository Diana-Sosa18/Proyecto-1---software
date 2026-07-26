const router = require("express").Router();
const { requireAdmin } = require("../middlewares/requireAdmin");
const service = require("../services/financialRulesService");
router.get("/admin/configuracion-financiera", requireAdmin, async (_req, res, next) => { try { res.json(await service.getRule()); } catch (e) { next(e); } });
router.put("/admin/configuracion-financiera", requireAdmin, async (req, res, next) => { try { res.json(await service.saveRule(req.body)); } catch (e) { next(e); } });
router.post("/admin/recargos/aplicar", requireAdmin, async (req, res, next) => { try { res.json(await service.applySurcharges(req.authUser.id)); } catch (e) { next(e); } });
module.exports = router;
