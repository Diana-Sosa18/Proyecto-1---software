const express = require('express');
const { requireAdminSession } = require('../middlewares/requireAdminSession');
const { createRefundService } = require('../services/recurrenteRefundService');
const { RefundError } = require('../services/recurrenteRefundContract');
function adminRecurrenteRefundRoutes(service = createRefundService()) {
  const router = express.Router();
  const handler = method => async (req, res, next) => {
    try {
      if (method === 'verify' && Object.keys(req.body || {}).length) throw new RefundError('REFUND_INVALID_REQUEST', 400);
      const result = await service[method](req.authUser, req.params.transactionId || req.params.refundId, req.body);
      res.set('Cache-Control', 'no-store').json(result);
    } catch (error) {
      // Provider errors never reach the generic logger, including nested headers/causes.
      if (error instanceof RefundError) return res.status(error.status).json({ code: error.code, message: error.message });
      next(new RefundError('REFUND_PERSISTENCE', 503, { uncertain: true }));
    }
  };
  router.get('/admin/pagos/recurrente/:transactionId/refund-eligibility', requireAdminSession, handler('eligibility'));
  router.get('/admin/pagos/recurrente/:transactionId/refunds', requireAdminSession, handler('history'));
  router.post('/admin/pagos/recurrente/:transactionId/refunds', requireAdminSession, handler('request'));
  router.post('/admin/pagos/recurrente/reembolsos/:refundId/verificar', requireAdminSession, handler('verify'));
  return router;
}
module.exports = { adminRecurrenteRefundRoutes };
