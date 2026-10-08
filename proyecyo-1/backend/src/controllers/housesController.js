const { listHouses, getHouseDetail, createHouse, updateHouse, setHouseActive } = require("../services/housesService");
const { getRequestMetadata, recordAudit } = require("../services/auditService");

async function getHouses(req, res, next) {
  try {
    res.status(200).json(await listHouses(req.query || {}));
  } catch (error) {
    next(error);
  }
}

async function getHouse(req, res, next) {
  try {
    res.status(200).json(await getHouseDetail(req.params.id));
  } catch (error) {
    next(error);
  }
}

async function postHouse(req, res, next) {
  try {
    const house = await createHouse(req.body || {});
    await recordAudit({ userId: req.authUser.id, action: "HOUSE_CREATED", entity: "CASA", entityId: house.id_casa, newData: house, metadata: getRequestMetadata(req) });
    res.status(201).json(house);
  } catch (error) {
    next(error);
  }
}

async function putHouse(req, res, next) {
  try {
    const previous = await getHouseDetail(req.params.id);
    const house = await updateHouse(req.params.id, req.body || {});
    await recordAudit({ userId: req.authUser.id, action: "HOUSE_UPDATED", entity: "CASA", entityId: house.id_casa, previousData: previous, newData: house, metadata: getRequestMetadata(req) });
    res.status(200).json(house);
  } catch (error) {
    next(error);
  }
}

async function patchHouseActive(req, res, next) {
  try {
    const house = await setHouseActive(req.params.id, req.body?.activo);
    await recordAudit({ userId: req.authUser.id, action: house.activo ? "HOUSE_ACTIVATED" : "HOUSE_DEACTIVATED", entity: "CASA", entityId: house.id_casa, newData: { activo: house.activo }, metadata: getRequestMetadata(req) });
    res.status(200).json(house);
  } catch (error) {
    next(error);
  }
}

module.exports = { getHouses, getHouse, postHouse, putHouse, patchHouseActive };
