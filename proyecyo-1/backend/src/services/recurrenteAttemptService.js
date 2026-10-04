const { createHash } = require("node:crypto");
const { recordIntentEvidence } = require('./recurrenteIntentHistory');

// Called inside HU14's signed inbox transaction, after the same quota/checkout
// ownership, environment, currency and authorized-amount checks. Never writes
// PAGO, CUOTA, allocations or checkout state. An intent is not a checkout.
async function recordAttempt(c, local, event, inbox, complete) {
  let transaction;
  if (event.externalId) {
    const [rows] = await c.execute(`SELECT * FROM TRANSACCION_RECURRENTE
      WHERE ambiente='sandbox' AND (id_externo=? OR (? IS NOT NULL AND id_pago_externo=?)) FOR UPDATE`,
    [event.externalId, event.paymentId, event.paymentId]);
    transaction = rows[0];
    if (transaction && transaction.id_pago) {
      const [history] = await c.execute(`SELECT * FROM INTENTO_RECURRENTE WHERE ambiente=? AND id_externo=? AND estado=?`,
        [local.ambiente,event.externalId,event.attemptState]);
      const old=history[0];
      if (rows.length===1 && old && Number(old.id_transaccion)===Number(transaction.id_transaccion)
        && Number(transaction.id_checkout)===Number(local.id_checkout) && old.id_pago_externo===(event.paymentId||null)
        && Number(old.monto_centavos)===event.amount && old.moneda===event.currency
        && old.fecha_proveedor_original===(event.time?.original||null)) {
        await c.execute(`UPDATE EVENTO_RECURRENTE SET resultado_intento=?,motivo_codigo=?,motivo_sanitizado=? WHERE id_evento=?`,
          [event.attemptState,event.reason.code,event.reason.message,inbox.id_evento]);
        await complete('PROCESADO');return 'duplicate';
      }
    }
    if (rows.length > 1 || transaction && (transaction.id_externo !== event.externalId
      || Number(transaction.id_checkout) !== Number(local.id_checkout)
      || Number(transaction.monto_centavos) !== event.amount || transaction.moneda !== event.currency
      || transaction.id_pago_externo && transaction.id_pago_externo !== event.paymentId
      || transaction.fecha_proveedor_original && event.time && transaction.fecha_proveedor_original !== event.time.original)) {
      return complete("REVISION", "WEBHOOK_TRANSACTION_MISMATCH");
    }
    if (transaction && (transaction.id_pago || transaction.confirmado_en
      || transaction.capital_aplicado_centavos !== null || transaction.recargo_aplicado_centavos !== null
      || !["PENDIENTE", event.attemptState].includes(transaction.estado))) {
      return complete("REVISION", "WEBHOOK_ATTEMPT_STATE_CONFLICT");
    }
  }
  await c.execute(`UPDATE EVENTO_RECURRENTE SET id_checkout=?,resultado_intento=?,motivo_codigo=?,motivo_sanitizado=?
    WHERE id_evento=?`, [local.id_checkout, event.attemptState, event.reason.code, event.reason.message, inbox.id_evento]);
  // Missing legacy canonical identity: the signed event itself is the retained
  // failure record. Do not guess a mapping to a later unified intent.
  if (!event.externalId) return complete("PROCESADO", "WEBHOOK_CANONICAL_INTENT_UNAVAILABLE");
  if (transaction?.estado === event.attemptState) {
    if (!await recordIntentEvidence(c,transaction,event,inbox,event.attemptState)) return complete('REVISION','WEBHOOK_TRANSACTION_MISMATCH');
    await complete("PROCESADO"); return "duplicate";
  }
  const audit = [event.attemptState, event.reason.code, event.reason.message, inbox.id_evento,
    event.paymentId, event.time?.utc || null, event.time?.original || null];
  if (transaction) {
    await c.execute(`UPDATE TRANSACCION_RECURRENTE SET estado=?,motivo_codigo=?,motivo_sanitizado=?,id_evento=?,
      id_pago_externo=COALESCE(id_pago_externo,?),fecha_proveedor_utc=COALESCE(fecha_proveedor_utc,?),
      fecha_proveedor_original=COALESCE(fecha_proveedor_original,?),finalizado_en=NOW(6) WHERE id_transaccion=?`,
    [...audit, transaction.id_transaccion]);
  } else {
    const key = createHash("sha256").update(`sandbox:intent:${event.externalId}`).digest("hex");
    const [created] = await c.execute(`INSERT INTO TRANSACCION_RECURRENTE
      (id_checkout,id_externo,idempotency_key,id_cuota,id_usuario,id_casa,monto_centavos,moneda,ambiente,
       estado,motivo_codigo,motivo_sanitizado,id_evento,id_pago_externo,fecha_proveedor_utc,fecha_proveedor_original,finalizado_en)
      VALUES(?,?,?,?,?,?,?,'GTQ','sandbox',?,?,?,?,?,?,?,NOW(6))`,
    [local.id_checkout, event.externalId, key, local.id_cuota, local.id_usuario, local.id_casa, event.amount, ...audit]);
    transaction={id_transaccion:created.insertId,ambiente:local.ambiente};
  }
  if (!await recordIntentEvidence(c,transaction,event,inbox,event.attemptState)) throw Object.assign(new Error('Conflicting intent identity.'),{code:'WEBHOOK_EVENT_CONFLICT'});
  return complete("PROCESADO");
}
module.exports = { recordAttempt };
