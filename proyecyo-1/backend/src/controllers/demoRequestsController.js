const service = require("../services/demoRequestsService");

async function create(req, res, next) {
  try {
    const result = await service.create(req.body);
    res.status(201).json(result);
  } catch (error) { next(error); }
}

async function list(req, res, next) {
  try { res.json(await service.list(req.query)); } catch (error) { next(error); }
}

async function detail(req, res, next) {
  try { res.json(await service.detail(req.params.id)); } catch (error) { next(error); }
}

async function updateStatus(req, res, next) {
  try { res.json(await service.updateStatus(req.params.id, req.body.estado)); } catch (error) { next(error); }
}

module.exports = { create, list, detail, updateStatus };
