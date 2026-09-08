const { loginUser, getCurrentSession } = require("../services/authService");

async function login(req, res, next) {
  try {
    const response = await loginUser(req.body || {});
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

async function session(req, res, next) {
  try {
    const authorization = String(req.header("authorization") || "");
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    const { verifySessionToken } = require("../services/sessionTokenService");
    const userId = verifySessionToken(match?.[1]);
    const current = await getCurrentSession(userId, match?.[1]);
    res.status(200).json(current);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  login,
  session,
};
