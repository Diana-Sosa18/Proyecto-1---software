const { createHash } = require('node:crypto');
const { toCents } = require('./financialBalance');
const { paymentReference } = require('./paymentReceiptService');

const DEADLINE_TYPES = ['CUOTA_PROXIMA', 'CUOTA_HOY', 'CUOTA_VENCIDA'];
const money = cents => {
  const value = BigInt(cents);
  return `Q${value / 100n}.${String(value % 100n).padStart(2,'0')}`;
};
const dedupKey = parts => createHash('sha256').update(JSON.stringify(parts)).digest('hex');
async function currentCycle(c, quotaId) {
  const [rows] = await c.execute('SELECT ciclo FROM CICLO_NOTIFICACION_CUOTA WHERE id_cuota=?', [quotaId]);
  return Number(rows[0]?.ciclo || 0);
}

// Caller MUST own a transaction and the CUOTA parent lock. No provider calls,
// payloads, headers or arbitrary reason text enter this table.
async function enqueue(c, data, identity) {
  const key = dedupKey(identity);
  const [existing] = await c.execute('SELECT id_entrega FROM ENTREGA_NOTIFICACION_FINANCIERA WHERE dedup_key=?', [key]);
  if (existing[0]) return { id: existing[0].id_entrega, created: false };
  const columns = ['dedup_key','id_usuario','id_cuota','id_pago','referencia_intento','id_reembolso','tipo_evento',
    'ciclo','ventana','fecha_objetivo','fecha_vencimiento','monto_centavos','saldo_centavos','recargo_centavos','moneda','ambiente',
    'titulo','mensaje','accion_codigo'];
  const record = { ciclo: 0, ventana: '', moneda: 'GTQ', ...data, dedup_key: key };
  try {
    const [result] = await c.execute(`INSERT INTO ENTREGA_NOTIFICACION_FINANCIERA
      (${columns.join(',')}) VALUES(${columns.map(() => '?').join(',')})`, columns.map(k => record[k] ?? null));
    return { id: result.insertId, created: true };
  } catch (error) {
    if (error.code !== 'ER_DUP_ENTRY') throw error;
    const [duplicate] = await c.execute('SELECT id_entrega FROM ENTREGA_NOTIFICACION_FINANCIERA WHERE dedup_key=?', [key]);
    if (!duplicate[0]) throw error; // Never hide another UNIQUE/FK/storage failure.
    return { id: duplicate[0].id_entrega, created: false };
  }
}

async function enqueuePayment(c, local, paymentId, event) {
  return enqueue(c, {
    id_usuario: local.id_usuario, id_cuota: local.id_cuota, id_pago: paymentId,
    tipo_evento: 'PAGO_CONFIRMADO', ciclo: await currentCycle(c, local.id_cuota),
    monto_centavos: event.amount, ambiente: local.ambiente, fecha_objetivo: event.time.accountingDate,
    titulo: 'Pago confirmado',
    mensaje: `Se confirmó tu pago de ${money(event.amount)} del ${event.time.accountingDate}. Comprobante ${paymentReference(paymentId)}.`,
    accion_codigo: 'COMPROBANTE_PAGO',
  }, ['pago', Number(paymentId), Number(local.id_usuario)]);
}

async function enqueueAttempt(c, local, event) {
  // A legacy event without a canonical intent is retained by HU15, but cannot
  // safely identify a notification shared with the unified alias. No guessing.
  if (!event.externalId || !['FALLIDA','CANCELADA'].includes(event.attemptState)) return;
  const canceled = event.attemptState === 'CANCELADA';
  return enqueue(c, {
    id_usuario: local.id_usuario, id_cuota: local.id_cuota, referencia_intento: event.externalId,
    tipo_evento: canceled ? 'PAGO_CANCELADO' : 'PAGO_NO_COMPLETADO', ambiente: local.ambiente,
    ciclo: await currentCycle(c, local.id_cuota), monto_centavos: event.amount,
    fecha_objetivo: event.time?.accountingDate || null,
    titulo: canceled ? 'Intento de pago cancelado' : 'Pago no completado',
    mensaje: `${canceled ? 'El intento fue cancelado.' : 'El intento de pago no se completó.'} No se registró un abono por este intento. Verifica y continúa únicamente si el estado de cuenta lo permite.`,
    accion_codigo: 'ESTADO_CUENTA',
  }, ['intento', local.ambiente, event.externalId, event.attemptState, Number(local.id_usuario)]);
}

async function enqueueRefund(c, local, refund, before, after, date) {
  const reopened = toCents(before.saldo) === 0 && toCents(after.saldo) > 0;
  if (reopened) await c.execute(`INSERT INTO CICLO_NOTIFICACION_CUOTA(id_cuota,ciclo) VALUES(?,1)
    ON DUPLICATE KEY UPDATE ciclo=ciclo+1,actualizado_en=NOW(6)`, [local.id_cuota]);
  const cycle = await currentCycle(c, local.id_cuota);
  return enqueue(c, {
    id_usuario: local.id_usuario, id_cuota: local.id_cuota, id_pago: local.id_pago, id_reembolso: refund.id_reembolso,
    tipo_evento: 'REEMBOLSO_CONFIRMADO', ciclo: cycle, monto_centavos: Number(refund.monto_centavos),
    saldo_centavos: toCents(after.saldo), ambiente: local.ambiente, fecha_objetivo: date,
    titulo: 'Reembolso confirmado',
    mensaje: `Se confirmó el reembolso de ${money(Number(refund.monto_centavos))} del pago ${paymentReference(local.id_pago)}. ${reopened ? 'La cuota vuelve a tener saldo pendiente.' : 'Saldo de la cuota tras el reembolso:'} ${money(toCents(after.saldo))}.`,
    accion_codigo: 'ESTADO_CUENTA',
  }, ['reembolso', Number(refund.id_reembolso), Number(local.id_usuario)]);
}

module.exports = { enqueue, enqueuePayment, enqueueAttempt, enqueueRefund, currentCycle, dedupKey, DEADLINE_TYPES, money };
