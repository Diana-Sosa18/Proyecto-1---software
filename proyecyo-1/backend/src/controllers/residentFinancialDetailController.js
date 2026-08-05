const { getFinancialDetail } = require("../services/residentFinancialDetailService");

async function getResidentFinancialDetail(req, res, next) {
  try {
    const detail = await getFinancialDetail(req.authUser.id, req.query || {});
    res.status(200).json(detail);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getResidentFinancialDetail,
};
