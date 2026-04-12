const {
  listResidentVisits,
  listFrequentVisitors,
  createVisit,
  deleteVisit,
  getGuardShiftVisits,
  validateQrVisit,
  registerQrEntry,
} = require("../services/visitsService");

async function getVisits(req, res, next) {
  try {
    const visits = await listResidentVisits(req.authUser.id);
    res.status(200).json(visits);
  } catch (error) {
    next(error);
  }
}

async function getFrequentVisitors(req, res, next) {
  try {
    const visitors = await listFrequentVisitors(req.authUser.id);
    res.status(200).json(visitors);
  } catch (error) {
    next(error);
  }
}

async function postVisit(req, res, next) {
  try {
    const visit = await createVisit(req.authUser.id, req.body || {});
    res.status(201).json(visit);
  } catch (error) {
    next(error);
  }
}

async function removeVisit(req, res, next) {
  try {
    const visit = await deleteVisit(req.authUser.id, Number(req.params.id));
    res.status(200).json(visit);
  } catch (error) {
    next(error);
  }
}

async function getGuardVisits(_req, res, next) {
  try {
    const visits = await getGuardShiftVisits();
    res.status(200).json(visits);
  } catch (error) {
    next(error);
  }
}

async function postValidateQr(req, res, next) {
  try {
    const visit = await validateQrVisit((req.body || {}).qrToken);
    res.status(200).json(visit);
  } catch (error) {
    next(error);
  }
}

async function postRegisterQrEntry(req, res, next) {
  try {
    const visit = await registerQrEntry((req.body || {}).qrToken);
    res.status(200).json(visit);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getVisits,
  getFrequentVisitors,
  postVisit,
  removeVisit,
  getGuardVisits,
  postValidateQr,
  postRegisterQrEntry,
};
