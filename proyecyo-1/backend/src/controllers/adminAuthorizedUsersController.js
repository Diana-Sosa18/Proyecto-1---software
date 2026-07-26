const { listAuthorizedTenants } = require("../services/adminAuthorizedUsersService");

async function getAuthorizedUsers(req, res, next) {
  try {
    const users = await listAuthorizedTenants(req.query || {});
    res.status(200).json(users);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAuthorizedUsers,
};
