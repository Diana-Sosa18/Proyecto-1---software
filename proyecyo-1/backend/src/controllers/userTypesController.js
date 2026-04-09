const { listUserTypes } = require("../services/userTypesService");

async function getUserTypes(_req, res, next) {
  try {
    const types = await listUserTypes();
    res.status(200).json(types);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getUserTypes,
};
