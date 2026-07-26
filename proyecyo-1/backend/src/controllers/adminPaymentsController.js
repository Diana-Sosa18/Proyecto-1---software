const { listDelinquentResidents } = require("../services/adminPaymentsService");

async function getAdminPayments(req, res, next) {
  try {
    const payments = await listDelinquentResidents(req.query || {});
    res.status(200).json(payments);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAdminPayments,
};
