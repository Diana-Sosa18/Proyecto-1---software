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
    const current = await getCurrentSession(req.header("x-user-id"));
    res.status(200).json(current);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  login,
  session,
};
