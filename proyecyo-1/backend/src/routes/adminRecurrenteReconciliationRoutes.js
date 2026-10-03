const express = require('express');
const { requireAdminSession } = require('../middlewares/requireAdminSession');
const { createReconciliationService } = require('../services/recurrenteReconciliationService');
const { createReconciliationController } = require('../controllers/adminRecurrenteReconciliationController');
function adminRecurrenteReconciliationRoutes(service = createReconciliationService()) {
  const router = express.Router(), controller = createReconciliationController(service);
  router.get('/admin/pagos/recurrente/transacciones', requireAdminSession, controller.list);
  router.post('/admin/pagos/recurrente/conciliacion', requireAdminSession, controller.verify);
  return router;
}
module.exports = { adminRecurrenteReconciliationRoutes };
