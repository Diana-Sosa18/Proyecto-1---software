const { listAuditLogs } = require("../services/auditService");

async function getAuditLogs(req, res, next) {
  try {
    const logs = await listAuditLogs({
      userId: req.query.userId,
      action: req.query.action,
      from: req.query.from,
      to: req.query.to,
    });
    res.status(200).json(logs);
  } catch (error) {
    next(error);
  }
}

module.exports = { getAuditLogs };
