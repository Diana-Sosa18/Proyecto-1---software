const { createRecurrenteReadClient } = require('../recurrenteReadClient');
const { context } = require('../../../test/fixtures/hu17');
const config = { secretKey: 'HU17_FAKE_OPAQUE_KEY', sandboxId: context.sandboxId, timeoutMs: 30 };
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } });
const preflight = () => json({ environment: 'sandbox', sandbox_id: context.sandboxId, account_id: context.accountId });
const co = { id: 'ch_HU17_FIXTURE', status: 'paid', total_in_cents: 500, currency: 'GTQ', payment: { id: 'pa_HU17_FIXTURE' } };
function setup() { const fetchImpl = jest.fn().mockResolvedValueOnce(preflight()); return { fetchImpl, client: createRecurrenteReadClient({ fetchImpl, configuration: () => config }) }; }
test('cliente GET exclusivo conserva diferencias válidas y solo usa key en headers backend', async () => {
  const s = setup(); s.fetchImpl.mockResolvedValueOnce(json({ ...co, total_in_cents: 750, currency: 'USD', card: { cvc: 'PRIVATE' }, secret: 'PRIVATE' }));
  const session = await s.client.open(), r = await session.getCheckout(co.id);
  expect(r.amount).toBe(750); expect(r.currency).toBe('USD'); expect(JSON.stringify(r)).not.toMatch(/PRIVATE|KEY|card|cvc/);
  for (const [url,options] of s.fetchImpl.mock.calls) { expect(url).toMatch(/^https:\/\/app.recurrente.com\/api\//); expect(options.method).toBe('GET'); expect(options.redirect).toBe('error'); expect(options.headers['X-SECRET-KEY']).toBe(config.secretKey); expect(options.body).toBeUndefined(); }
});
test.each([[401,'AUTENTICACION_PROVEEDOR'],[403,'AUTENTICACION_PROVEEDOR'],[429,'LIMITE_PROVEEDOR'],[500,'PROVEEDOR_NO_DISPONIBLE'],[503,'PROVEEDOR_NO_DISPONIBLE'],[404,'REFERENCIA_NO_LOCALIZADA']])('HTTP %i produce código seguro', async (status, code) => {
  const s = setup(); s.fetchImpl.mockResolvedValueOnce(json({ secret: 'PRIVATE' }, status)); const session = await s.client.open();
  await expect(session.getCheckout(co.id)).rejects.toMatchObject({ code });
});
test('timeout no filtra causa y cancela request', async () => {
  const s = setup(); s.fetchImpl.mockImplementationOnce(() => new Promise(() => {})); const session = await s.client.open();
  await expect(session.getCheckout(co.id)).rejects.toMatchObject({ code: 'TIMEOUT' }); expect(s.fetchImpl.mock.calls[1][1].signal.aborted).toBe(true);
});
test.each([
  { environment: 'production', sandbox_id: context.sandboxId, account_id: context.accountId },
  { environment: 'sandbox', sandbox_id: 'sbx_OTHER', account_id: context.accountId },
  { environment: 'sandbox', sandbox_id: context.sandboxId },
])('preflight exige cuenta y Sandbox esperado', async data => { const s = setup(); s.fetchImpl.mockReset().mockResolvedValue(json(data)); await expect(s.client.open()).rejects.toMatchObject({ code: 'CONTEXTO_SANDBOX_INVALIDO' }); expect(s.fetchImpl).toHaveBeenCalledTimes(1); });
test.each([[],'text',{ ...co, total_in_cents: 1.5 },{ ...co, created_at: 'invalid' },{ ...co, payment: 'pa_not-object' }])('respuesta malformada queda ERROR y no incluye payload', async data => {
  const s = setup(); s.fetchImpl.mockResolvedValueOnce(json(data)); const session = await s.client.open(); await expect(session.getCheckout(co.id)).rejects.toMatchObject({ code: 'RESPUESTA_INVALIDA' });
});
test('campo opcional ausente no inventa evidencia', async () => { const s = setup(); s.fetchImpl.mockResolvedValueOnce(json({ id: co.id, status: 'paid' })); const session = await s.client.open(); expect((await session.getCheckout(co.id)).amount).toBeNull(); });
test('referencia externa no permite URLs arbitrarias', async () => { const s = setup(); const session = await s.client.open(); await expect(session.getCheckout('https://evil.example')).rejects.toMatchObject({ code: 'REFERENCIA_INVALIDA' }); expect(s.fetchImpl).toHaveBeenCalledTimes(1); });
const from = '2026-10-01T00:00:00-06:00', until = '2026-10-02T23:59:59-06:00';
test('listado recorre páginas declaradas y elimina duplicados idénticos', async () => {
  const s = setup(); s.fetchImpl.mockResolvedValueOnce(json([co],200,{'current-page':'1','total-pages':'2'})).mockResolvedValueOnce(json([co,{ ...co,id:'ch_SECOND' }],200,{'current-page':'2','total-pages':'2','total-count':'2'}));
  const r = await (await s.client.open()).discoverCheckouts(from,until); expect(r.complete).toBe(true); expect(r.pages).toBe(2); expect(r.records).toHaveLength(2);
});
test('sin metadata de paginación siempre parcial, incluso página vacía', async () => { const s = setup(); s.fetchImpl.mockResolvedValueOnce(json([])); const r = await (await s.client.open()).discoverIntents(from,until); expect(r.complete).toBe(false); expect(r.reason).toBe('SIN_EVIDENCIA_DE_FIN'); });
test('Link next malicioso no se sigue ni expone key', async () => { const s = setup(); s.fetchImpl.mockResolvedValueOnce(json([co],200,{link:'<https://evil.example/api/checkouts>; rel="next"'})); const r = await (await s.client.open()).discoverCheckouts(from,until); expect(r.complete).toBe(false); expect(s.fetchImpl).toHaveBeenCalledTimes(2); });
test('Link next válido se sigue y last demuestra fin', async () => {
  const s = setup(), url = new URL('https://app.recurrente.com/api/checkouts'); url.search = new URLSearchParams({from_time:from,until_time:until,page:'2',items:'100'});
  s.fetchImpl.mockResolvedValueOnce(json([co],200,{ link:`<${url.href}>; rel="next"` })).mockResolvedValueOnce(json([],200,{ link:`<${url.href}>; rel="last"` }));
  expect((await (await s.client.open()).discoverCheckouts(from,until)).complete).toBe(true);
});
test('ciclo de Link y cambio de registros devuelven parcial', async () => {
  const s = setup(); const url = new URL('https://app.recurrente.com/api/checkouts'); url.search = new URLSearchParams({from_time:from,until_time:until,page:'1',items:'100'});
  s.fetchImpl.mockResolvedValueOnce(json([co],200,{ link:`<${url.href}>; rel="next"` })); expect((await (await s.client.open()).discoverCheckouts(from,until)).reason).toBe('PAGINACION_CICLICA');
});
test('recuento inconsistente nunca se declara completo', async () => { const s = setup(); s.fetchImpl.mockResolvedValueOnce(json([co],200,{'current-page':'1','total-pages':'1','total-count':'10'})); expect((await (await s.client.open()).discoverCheckouts(from,until)).complete).toBe(false); });
