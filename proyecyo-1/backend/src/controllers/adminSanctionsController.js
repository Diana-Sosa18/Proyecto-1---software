const {
  applyAutomaticSanctions,
  getSanctionSummary,
  listSanctionRules,
  listSanctionHistory,
  listSanctions,
  updateSanctionStatus,
} = require("../services/adminSanctionsService");

async function getAdminSanctionSummary(_req, res, next) {
  try {
    const summary = await getSanctionSummary();
    res.status(200).json(summary);
  } catch (error) {
    next(error);
  }
}

async function getAdminSanctionRules(_req, res, next) {
  try {
    const rules = await listSanctionRules();
    res.status(200).json(rules);
  } catch (error) {
    next(error);
  }
}

async function generateAdminSanctions(req, res, next) {
  try {
    const result = await applyAutomaticSanctions(req.authUser.id);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

async function getAdminSanctions(req, res, next) {
  try {
    const sanctions = await listSanctions(req.query || {});
    res.status(200).json(sanctions);
  } catch (error) {
    next(error);
  }
}

async function getAdminSanctionHistory(req, res, next) {
  try {
    const history = await listSanctionHistory(req.query || {});
    res.status(200).json(history);
  } catch (error) {
    next(error);
  }
}

async function patchAdminSanctionStatus(req, res, next) {
  try {
    const sanction = await updateSanctionStatus(
      req.params.id,
      req.body?.estado,
      req.authUser.id,
    );
    res.status(200).json(sanction);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAdminSanctionSummary,
  getAdminSanctionRules,
  generateAdminSanctions,
  getAdminSanctions,
  getAdminSanctionHistory,
  patchAdminSanctionStatus,
};
