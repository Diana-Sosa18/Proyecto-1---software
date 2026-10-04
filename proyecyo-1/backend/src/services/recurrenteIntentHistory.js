const { paymentTime } = require('./recurrenteWebhookPayload');

// Append-only provider evidence. Never update an earlier attempt's result/IDs.
async function recordIntentEvidence(c, transaction, event, inbox, state) {
  const [existing] = await c.execute(`SELECT * FROM INTENTO_RECURRENTE
    WHERE ambiente=? AND id_externo=? FOR UPDATE`, [transaction.ambiente, event.externalId]);
  if (existing.some(row => Number(row.id_transaccion) !== Number(transaction.id_transaccion))) return false;
  const same = existing.find(row => row.estado === state);
  if (same) return same.id_pago_externo === (event.paymentId || null)
    && Number(same.monto_centavos) === event.amount && same.moneda === event.currency
    && same.fecha_proveedor_original === (event.time?.original || null);
  await c.execute(`INSERT INTO INTENTO_RECURRENTE
    (id_transaccion,id_externo,id_pago_externo,ambiente,moneda,monto_centavos,estado,id_evento,
     fecha_proveedor_original,fecha_proveedor_utc,motivo_codigo,motivo_sanitizado)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`, [transaction.id_transaccion,event.externalId,event.paymentId || null,
    transaction.ambiente,event.currency,event.amount,state,inbox.id_evento,event.time?.original || null,
    event.time?.utc || null,event.reason?.code || null,event.reason?.message || null]);
  return true;
}

async function strongSuccessTransition(c, transaction, local, event, sandboxId) {
  if (!['FALLIDA','CANCELADA'].includes(transaction.estado) || transaction.id_pago
    || transaction.confirmado_en || transaction.capital_aplicado_centavos != null
    || transaction.recargo_aplicado_centavos != null || !transaction.id_evento
    || !event.paymentId || transaction.id_pago_externo !== event.paymentId
    || event.checkoutStatus !== 'paid' || event.latestIntentId !== event.externalId
    || event.liveMode !== false || event.sandboxId !== sandboxId || event.environment !== 'sandbox'
    || event.checkoutId !== local.id_externo
    || !event.time || !transaction.fecha_proveedor_original) return false;
  const previousTime = paymentTime(transaction.fecha_proveedor_original);
  if (!previousTime || event.time.utc <= previousTime.utc) return false;
  const [previous] = await c.execute('SELECT * FROM EVENTO_RECURRENTE WHERE id_evento=?', [transaction.id_evento]);
  const receipt = previous[0];
  if (!receipt || receipt.estado !== 'PROCESADO' || receipt.resultado_intento !== transaction.estado
    || Number(receipt.id_checkout) !== Number(local.id_checkout) || receipt.ambiente !== 'sandbox'
    || receipt.sandbox_id !== sandboxId || ![0,false].includes(receipt.live_mode)
    || !(transaction.estado==='CANCELADA' ? ['intent.canceled'] : ['payment_intent.failed','intent.failed']).includes(receipt.tipo_evento)) return false;
  return recordIntentEvidence(c, transaction, {
    externalId: transaction.id_externo, paymentId: transaction.id_pago_externo,
    amount: Number(transaction.monto_centavos), currency: transaction.moneda, time: previousTime,
    reason: { code: transaction.motivo_codigo, message: transaction.motivo_sanitizado },
  }, receipt, transaction.estado);
}

module.exports = { recordIntentEvidence, strongSuccessTransition };
