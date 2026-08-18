const { listDelinquentResidents, getMonthlyFinancialReport, listRecentPayments } = require("../services/adminPaymentsService");

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
  getRecentPayments: async (req, res, next) => { try { res.json(await listRecentPayments(req.query || {})); } catch (error) { next(error); } },
  getMonthlyReport: async (req, res, next) => { try { res.json(await getMonthlyFinancialReport(req.query.mes, req.query.anio)); } catch (error) { next(error); } },
};
