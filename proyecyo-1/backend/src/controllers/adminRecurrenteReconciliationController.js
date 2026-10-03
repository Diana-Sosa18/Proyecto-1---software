function createReconciliationController(service) {
  return {
    async list(req, res, next) {
      try { res.set('Cache-Control', 'private, no-store').json(await service.list(req.query)); } catch (e) { next(e); }
    },
    async verify(req, res, next) {
      try { res.set('Cache-Control', 'private, no-store').json(await service.verify(req.body)); } catch (e) { next(e); }
    },
  };
}
module.exports = { createReconciliationController };
