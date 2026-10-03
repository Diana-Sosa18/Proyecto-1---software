jest.mock('../../database/mysql', () => ({ pool: {} }));
const { fixture, context } = require('../../../test/fixtures/hu17');
const { compareOperation, officialDate } = require('../recurrenteReconciliationCompare');
const { createReconciliationService, filters, selection } = require('../recurrenteReconciliationService');
test.each(['succeeded', 'failed', 'canceled'])('%s con evidencia coherente se concilia', status => {
  const { local, observation } = fixture(status); expect(compareOperation(local, observation).clasificacion).toBe('CONCILIADA');
});
test.each([
  ['monto', (l,o) => { o.intent.amount = 600; }], ['moneda', (l,o) => { o.intent.currency = 'USD'; }],
  ['ambiente', (l,o) => { o.intent.liveMode = true; }], ['sandbox', (l,o) => { o.checkout.sandboxId = 'sbx_OTHER'; }],
  ['estado', (l,o) => { o.intent.status = 'failed'; }], ['PAGO ausente', l => { l.payment = null; }],
  ['id_pago', l => { l.payment.id_pago = 396; }], ['referencia PA', (l,o) => { o.checkout.paymentId = 'pa_OTHER'; }],
  ['residente', l => { l.residentId = 2; }], ['cuota', l => { l.intent.id_cuota = 998; }],
  ['fecha', (l,o) => { o.intent.createdAt = '2026-10-04T01:00:00Z'; }], ['checkout', (l,o) => { o.intent.checkout.id = 'ch_OTHER'; }],
  ['aplicación centavos', l => { l.intent.capital_aplicado_centavos = 600; }],
])('%s distinto es DIFERENCIA autoritativa', (_name, mutate) => {
  const { local, observation } = fixture(); mutate(local, observation);
  const result = compareOperation(local, observation); expect(result.clasificacion).toBe('DIFERENCIA'); expect(result.diferencias.length).toBeGreaterThan(0);
});
test('404 solo es diferencia después del preflight', () => {
  const { local } = fixture(); expect(compareOperation(local, { context, error: 'REFERENCIA_NO_LOCALIZADA' }).clasificacion).toBe('DIFERENCIA');
  expect(compareOperation(local, { error: 'REFERENCIA_NO_LOCALIZADA' }).clasificacion).toBe('ERROR_DE_VERIFICACION');
});
test.each(['TIMEOUT','AUTENTICACION_PROVEEDOR','LIMITE_PROVEEDOR','PROVEEDOR_NO_DISPONIBLE','RESPUESTA_INVALIDA','CONTEXTO_SANDBOX_INVALIDO'])('%s no es diferencia', error => {
  expect(compareOperation(fixture().local, { context, error }).clasificacion).toBe('ERROR_DE_VERIFICACION');
});
test.each(['amount','currency','id','status','type'])('campo intent %s ausente queda pendiente', field => {
  const { local, observation } = fixture(); observation.intent[field] = null;
  expect(compareOperation(local, observation).clasificacion).toBe('PENDIENTE');
});
test.each(['pending', 'payment_in_progress', 'uncertain', 'refund', 'concurrent', 'providerChange'])('%s no decide conciliación definitiva', state => {
  const { local, observation } = fixture(state === 'pending' ? 'pending' : state === 'payment_in_progress' ? 'failed' : 'succeeded');
  if (state === 'payment_in_progress') { local.checkout.estado_proveedor = observation.checkout.status = observation.intent.checkout.status = 'payment_in_progress'; }
  if (state === 'uncertain') local.checkout.estado = 'INCIERTO';
  if (state === 'refund') local.refunds = [{ id_reembolso: 1 }];
  if (state === 'concurrent') observation.concurrent = true;
  if (state === 'providerChange') observation.intent.checkout.status = 'unpaid';
  expect(compareOperation(local, observation).clasificacion).toBe('PENDIENTE');
});
test('FALLIDA con abono es diferencia; no se corrige', () => { const { local, observation } = fixture('failed'); local.intent.id_pago = 395;
  expect(compareOperation(local, observation).clasificacion).toBe('DIFERENCIA'); expect(local.intent.id_pago).toBe(395); });
test('timestamp oficial se convierte a Guatemala, no a la fecha de recepción', () => {
  expect(officialDate('2026-10-03T01:00:00Z')).toBe('2026-10-02'); expect(officialDate(null)).toBeNull();
});
function setup(status = 'succeeded') {
  const { local, observation } = fixture(status), load = jest.fn(async () => ({ operations: [structuredClone(local)], complete: true }));
  const session = { context, getCheckout: jest.fn(async () => observation.checkout), getIntent: jest.fn(async () => observation.intent) };
  const client = { open: jest.fn(async () => session) }; return { service: createReconciliationService({ load, client }), load, client, session, local };
}
test('GET local nunca abre cliente Recurrente', async () => { const s = setup(); const r = await s.service.list({}); expect(s.client.open).not.toHaveBeenCalled(); expect(r.verificado).toBe(false); });
test('verificación repetida no muta snapshot ni crea historial durable', async () => {
  const s = setup(), before = JSON.stringify(s.local); const a = await s.service.verify({ id_transaccion: 296 }), b = await s.service.verify({ id_transaccion: 296 });
  expect(a).toEqual(b); expect(a.operaciones[0].clasificacion).toBe('CONCILIADA'); expect(JSON.stringify(s.local)).toBe(before); expect(s.load).toHaveBeenCalledTimes(4);
});
test('dos verificaciones simultáneas comparten GET y mantienen lectura independiente', async () => {
  const s = setup(); let resolve; s.session.getCheckout.mockImplementation(() => new Promise(r => { resolve = r; }));
  const a = s.service.verify({ id_transaccion: 296 }), b = s.service.verify({ id_transaccion: 296 });
  await new Promise(r => setImmediate(r)); resolve(fixture().observation.checkout); const results = await Promise.all([a,b]);
  expect(results[0]).toEqual(results[1]); expect(s.session.getCheckout).toHaveBeenCalledTimes(1); expect(s.load).toHaveBeenCalledTimes(4);
});
test('cambio local entre snapshot y reread es pendiente', async () => {
  const s = setup(); const changed = structuredClone(s.local); changed.checkout.actualizado_en = 'later';
  s.load.mockResolvedValueOnce({ operations: [s.local], complete: true }).mockResolvedValueOnce({ operations: [changed], complete: true });
  const r = await s.service.verify({ id_transaccion: 296 }); expect(r.operaciones[0].motivo).toBe('CAMBIO_CONCURRENTE');
});
test('eventos duplicados no multiplican intento ni abono', async () => { const s = setup(); s.local.events = [{ id_evento: 1, svix_id: 'msg_fixture', tipo_evento: 'intent.succeeded', estado: 'IGNORADO', intentos: 2 }];
  const r = await s.service.verify({ id_transaccion: 296 }); expect(r.operaciones).toHaveLength(1); expect(r.operaciones[0].id_pago).toBe(395); });
test('preflight fallido impide todos los GET de recursos', async () => {
  const s = setup(); s.client.open.mockRejectedValue({ code: 'CONTEXTO_SANDBOX_INVALIDO', message: 'PRIVATE' });
  const r = await s.service.verify({ id_transaccion: 296 }); expect(r.operaciones[0].clasificacion).toBe('ERROR_DE_VERIFICACION'); expect(s.session.getCheckout).not.toHaveBeenCalled(); expect(JSON.stringify(r)).not.toContain('PRIVATE');
});
test.each(['checkout','intent'])('404 identifica exactamente el recurso %s que no fue localizado', async resource => {
  const s = setup(); s.session[resource === 'checkout' ? 'getCheckout' : 'getIntent'].mockRejectedValue({ code: 'REFERENCIA_NO_LOCALIZADA' });
  const op = (await s.service.verify({ id_transaccion: 296 })).operaciones[0];
  expect(op.clasificacion).toBe('DIFERENCIA');
  expect(op.diferencias[0]).toMatchObject({ campo: `${resource}.referencia_externa`, interno: s.local[resource].id_externo });
});
test('operación local inexistente no llama a proveedor', async () => { const s = setup(); s.load.mockResolvedValue({ operations: [], complete: true });
  await expect(s.service.verify({ id_transaccion: 296 })).rejects.toMatchObject({ status: 404 }); expect(s.client.open).not.toHaveBeenCalled(); });
test('fechas ausentes se muestran explícitamente aunque exista filtro temporal', async () => {
  const s = setup('failed'); s.local.intent.fecha_proveedor_original = null; const o = fixture('failed').observation.intent; o.createdAt = null; s.session.getIntent.mockResolvedValue(o);
  const r = await s.service.verify({ filtros: { desde: '2030-01-01', hasta: '2030-02-01' } }); expect(r.operaciones[0].sin_fecha_verificable).toBe(true);
});
test('filtro de resultado conserva resumen del alcance evaluado', async () => { const s = setup(); const r = await s.service.verify({ filtros: { resultado: 'DIFERENCIA' } });
  expect(r.operaciones).toEqual([]); expect(r.resumen.conciliadas).toBe(1); });
test.each([{ monto: 500 }, { ambiente: 'production' }, { id_transaccion: 1, id_checkout: 2 }, { ids_transacciones: [] }, { id_transaccion: -1 }, { descubrir_externas: true }, { filtros: { referencia: 'x;DROP' } }, { filtros: { hasta: '2026-02-30' } }])('selección rechaza payload arbitrario %j', body => expect(() => selection(body)).toThrow());
test.each([{ estado_local: 'FALLIDA' },{ residente: '1' },{ referencia: 'NXR-00000395' },{ desde: '2026-10-02', hasta: '2026-10-03' }])('filtro validado %j', value => expect(filters(value)).toEqual(value));
test('descubrimiento separa candidatos, excluye intent bancario y respeta asociaciones exactas', async () => {
  const s = setup(); s.session.discoverIntents = jest.fn(async () => ({ records: [fixture().observation.intent, { ...fixture().observation.intent, id: 'in_UNASSOCIATED' }, { ...fixture().observation.intent, id: 'in_BANK', type: 'bank_transfer' }], complete: true, pages: 1, reason: null }));
  s.session.discoverCheckouts = jest.fn(async () => ({ records: [fixture().observation.checkout], complete: false, pages: 1, reason: 'SIN_EVIDENCIA_DE_FIN' }));
  const r = await s.service.verify({ filtros: { desde: '2026-10-01', hasta: '2026-10-04' }, descubrir_externas: true });
  expect(r.completo).toBe(false); expect(r.externas_sin_asociacion.map(c => c.id_externo)).toEqual(['in_UNASSOCIATED']);
  expect(s.load.mock.calls.some(([c]) => c.externalIds?.includes('in_UNASSOCIATED'))).toBe(true);
});
