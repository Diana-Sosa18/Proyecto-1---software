const { listTenantAccountStatement } = require("../services/tenantAccountService");

async function getTenantAccountStatement(req, res, next) {
  try {
    const statement = await listTenantAccountStatement(req.authUser.id);
    res.status(200).json(statement);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getTenantAccountStatement,
};
