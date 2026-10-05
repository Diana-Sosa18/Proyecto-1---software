jest.mock('../../database/mysql', () => ({query:jest.fn(),pool:{}}));
const {guatemalaDate,daysBetween,plusDays,__private__:rules} = require('../financialNotificationsService');
const {enqueue,enqueueAttempt,dedupKey,money} = require('../financialNotificationOutbox');
const {markAllNotificationsAsRead} = require('../notificationsService');
const {query} = require('../../database/mysql');

test.each([
  ['2026-10-05T00:00:00Z','2026-10-04'],['2026-10-05T05:59:59Z','2026-10-04'],
  ['2026-10-05T06:00:00Z','2026-10-05'],['2027-01-01T00:00:00Z','2026-12-31'],
])('calendario Guatemala %s', (time,date) => expect(guatemalaDate(new Date(time))).toBe(date));
test('aritmética de días cruza mes y año sin depender del TZ del proceso', () => {
  expect(daysBetween('2026-12-30','2027-01-06')).toBe(7); expect(plusDays('2026-12-30',7)).toBe('2027-01-06');
});
test.each([['2026-10-04',3,'CUOTA_PROXIMA'],['2026-10-07',3,'CUOTA_HOY'],['2026-10-08',3,'CUOTA_VENCIDA']])('etapa %s', async(day,lead,type) => {
  const c={execute:jest.fn().mockResolvedValue([[]])};
  expect((await rules.stage(c,{id_cuota:1,vencimiento:'2026-10-07'},3,0,day,lead)).type).toBe(type);
});
test('fuera de ventana no genera etapa', async () => expect(await rules.stage({}, {vencimiento:'2026-10-07'},3,0,'2026-10-03',3)).toBeNull());
test('intervalo semanal anclado a última entrega efectiva, sin ráfaga atrasada', async () => {
  const c={execute:jest.fn().mockResolvedValue([[{ultima:'2026-10-04',ventana:'INICIAL'}]])},q={id_cuota:1,vencimiento:'2026-10-01'};
  expect(await rules.stage(c,q,3,0,'2026-10-10',3)).toBeNull();
  expect(await rules.stage(c,q,3,0,'2026-10-11',3)).toMatchObject({window:'SEMANA:1',date:'2026-10-11'});
  expect(await rules.stage(c,q,3,0,'2026-11-02',3)).toMatchObject({window:'SEMANA:1'});
});
test('dedup usa identidad de negocio, sin svix-id ni información sensible', () => {
  expect(dedupKey(['pago',395,3])).toBe(dedupKey(['pago',395,3]));
  expect(dedupKey(['pago',395,3])).not.toBe(dedupKey(['pago',395,4]));
});
test('formato conserva exactamente centavos, incluso el máximo entero seguro', () => {
  expect(money(500)).toBe('Q5.00'); expect(money(6501)).toBe('Q65.01');
  expect(money(Number.MAX_SAFE_INTEGER)).toBe('Q90071992547409.91');
});
test('errores SQL arbitrarios se propagan para rollback financiero', async () => {
  const failure = Object.assign(new Error('FAKE_PRIVATE_SQL'),{code:'ER_NO_REFERENCED_ROW_2'});
  const c={execute:jest.fn().mockResolvedValueOnce([[]]).mockRejectedValueOnce(failure)};
  await expect(enqueue(c,{},['test'])).rejects.toBe(failure);
});
test('otro conflicto UNIQUE no se oculta como dedup válida', async () => {
  const failure=Object.assign(new Error('FAKE_SQL'),{code:'ER_DUP_ENTRY'});
  const c={execute:jest.fn().mockResolvedValueOnce([[]]).mockRejectedValueOnce(failure).mockResolvedValueOnce([[]])};
  await expect(enqueue(c,{},['test'])).rejects.toBe(failure);
});
test('no inventa identidad del intento legacy ni aviso por timeout/retorno', async () => {
  const c={execute:jest.fn()}; await enqueueAttempt(c,{}, {attemptState:'FALLIDA'});
  await enqueueAttempt(c,{}, {externalId:'in_TEST',attemptState:'INCIERTO'}); expect(c.execute).not.toHaveBeenCalled();
});
test('marcar todas devuelve conteo vigente si un aviso llegó durante lectura', async () => {
  query.mockResolvedValueOnce({affectedRows:10}).mockResolvedValueOnce([{total:1}]);
  expect(await markAllNotificationsAsRead(3)).toEqual({unread:1});
});
