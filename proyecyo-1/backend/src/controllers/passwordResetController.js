const { requestPasswordReset, resetPassword } = require("../services/passwordResetService");
const { getRequestMetadata } = require("../services/auditService");

async function forgotPassword(req, res, next) {
  try {
    const result = await requestPasswordReset(req.body?.email);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function changeForgottenPassword(req, res, next) {
  try {
    const result = await resetPassword(req.body || {}, getRequestMetadata(req));
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = { changeForgottenPassword, forgotPassword };
