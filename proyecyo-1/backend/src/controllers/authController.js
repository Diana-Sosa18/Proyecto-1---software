const { loginUser } = require("../services/authService");

async function login(req, res, next) {
  try {
    const response = await loginUser(req.body || {});
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  login,
};