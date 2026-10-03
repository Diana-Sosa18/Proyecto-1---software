jest.mock('../../services/authService', () => ({ getCurrentSession: jest.fn() }));
jest.mock('../../services/activeSessionsService', () => ({ assertActiveSession: jest.fn() }));
jest.mock('../../database/mysql', () => ({ pool: {} }));
const request = require('supertest'), express = require('express');
const { getCurrentSession } = require('../../services/authService'), { assertActiveSession } = require('../../services/activeSessionsService');
const { createSessionToken } = require('../../services/sessionTokenService');
const { adminRecurrenteReconciliationRoutes } = require('../adminRecurrenteReconciliationRoutes');
const service = { list: jest.fn(), verify: jest.fn() }, app = express(); app.use(express.json()); app.use(adminRecurrenteReconciliationRoutes(service));
app.use((e,_req,res,_next) => res.status(e.status || 500).json({ message: e.status < 500 ? e.message : 'Error interno' }));
const auth = () => `Bearer ${createSessionToken(1,'hu17-unit-session')}`;
const path = '/admin/pagos/recurrente/conciliacion', list = '/admin/pagos/recurrente/transacciones';
beforeEach(() => { jest.clearAllMocks(); getCurrentSession.mockResolvedValue({ id: 1, role: 'admin' }); assertActiveSession.mockResolvedValue(); service.list.mockResolvedValue({ operaciones: [] }); service.verify.mockResolvedValue({ operaciones: [] }); });
test('ADMIN validado en DB accede, con no-store y filtros locales', async () => {
  const r = await request(app).get(list+'?residente=1&referencia=in_fixture').set('Authorization',auth()).expect(200);
  expect(r.headers['cache-control']).toBe('private, no-store'); expect(service.list).toHaveBeenCalledWith({ residente: '1', referencia: 'in_fixture' }); expect(getCurrentSession).toHaveBeenCalledWith(1);
});
test('POST usa selección sin convertirla en pago', async () => { await request(app).post(path).set('Authorization',auth()).send({ id_transaccion: 296 }).expect(200); expect(service.verify).toHaveBeenCalledWith({id_transaccion:296}); });
test.each(['residente','inquilino','guardia'])('%s se deniega antes de consultar proveedor', async role => { getCurrentSession.mockResolvedValue({ id: 1, role }); await request(app).post(path).set('Authorization',auth()).send({id_transaccion:296}).expect(403); expect(service.verify).not.toHaveBeenCalled(); });
test.each([list,path])('sin token y headers falsificados no accede %s', async p => {
  await request(app)[p===list?'get':'post'](p).set('x-user-role','admin').set('x-user-id','1').expect(401); expect(service.list).not.toHaveBeenCalled(); expect(service.verify).not.toHaveBeenCalled();
});
test('sesión revocada no accede', async () => { assertActiveSession.mockRejectedValue(Object.assign(new Error('Revocada'),{status:401})); await request(app).post(path).set('Authorization',auth()).send({}).expect(401); expect(service.verify).not.toHaveBeenCalled(); });
test('token manipulado no usa headers de rescate', async () => { await request(app).post(path).set('Authorization',auth()+'tampered').set('x-user-role','admin').send({}).expect(401); expect(service.verify).not.toHaveBeenCalled(); });
