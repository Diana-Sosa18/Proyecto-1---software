const {
  listRestoreHistory,
  restoreBackup,
  validateBackup,
} = require("../services/restoresService");

async function getRestoreHistory(_req, res, next) {
  try {
    const history = await listRestoreHistory();
    res.status(200).json(history);
  } catch (error) {
    next(error);
  }
}

async function postValidateBackup(req, res, next) {
  try {
    const validation = await validateBackup(req.body || {});
    res.status(200).json(validation);
  } catch (error) {
    next(error);
  }
}

async function postRestoreBackup(req, res, next) {
  try {
    const result = await restoreBackup(req.authUser.id, req.body || {});
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getRestoreHistory,
  postRestoreBackup,
  postValidateBackup,
};
