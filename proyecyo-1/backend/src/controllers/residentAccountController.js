const { listResidentAccountStatement } = require("../services/residentAccountService");

async function getResidentAccountStatement(req, res, next) {
  try {
    const statement = await listResidentAccountStatement(req.authUser.id);
    res.status(200).json(statement);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getResidentAccountStatement,
};
