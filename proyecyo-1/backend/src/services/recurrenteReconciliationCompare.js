const { toCents } = require('./financialBalance');
const { paymentTime } = require('./recurrenteWebhookPayload');
const RESULTS = ['CONCILIADA', 'DIFERENCIA', 'PENDIENTE', 'ERROR_DE_VERIFICACION'];
function officialDate(original) { return paymentTime(original)?.accountingDate ?? null; }
function compareOperation(local, observation = {}) {
  const differences = [], missing = [], checks = [];
  const { checkout: co, intent: tr, payment: pg } = local;
  const remote = observation.intent, external = observation.checkout, context = observation.context;
  function match(field, internal, observed, required = true) {
    if (internal == null || observed == null) { if (required) missing.push(field); checks.push({ campo: field, coincide: null }); return; }
    const equal = internal === observed; checks.push({ campo: field, coincide: equal });
    if (!equal) differences.push({ codigo: 'VALOR_DISTINTO', campo: field, interno: internal, externo: observed });
  }
  const result = (classification, reason = null) => ({ clasificacion: classification, motivo: reason, diferencias: differences, faltantes: [...new Set(missing)], comprobaciones: checks });
  if (observation.concurrent) return result('PENDIENTE', 'CAMBIO_CONCURRENTE');
  if (observation.error) {
    const absent = observation.error === 'REFERENCIA_NO_LOCALIZADA' && context;
    if (absent) differences.push({ codigo: 'REFERENCIA_NO_LOCALIZADA', campo: `${observation.resource || 'operacion'}.referencia_externa`, interno: observation.reference || tr?.id_externo || co.id_externo, externo: null });
    return result(absent ? 'DIFERENCIA' : 'ERROR_DE_VERIFICACION', observation.error);
  }
  if (!external || tr && !remote) return result('PENDIENTE', 'SIN_EVIDENCIA_EXTERNA');
  match('checkout.id', co.id_externo, external.id);
  match('checkout.monto_centavos', Number(co.monto_centavos), external.amount);
  match('checkout.moneda', co.moneda, external.currency);
  match('checkout.estado_proveedor', co.estado_proveedor, external.status);
  const checkoutStates = { unpaid: 'PENDIENTE', paid: 'CONFIRMADO', expired: 'EXPIRADO', payment_in_progress: 'PENDIENTE' };
  // An uncertain operation needs resolution in the existing payment flow, never here.
  if (co.estado === 'INCIERTO') return result('PENDIENTE', 'OPERACION_INCIERTA');
  if (checkoutStates[external.status]) match('checkout.estado_local', co.estado, checkoutStates[external.status]);
  match('ambiente', co.ambiente, context?.environment);
  match('sandbox', co.sandbox_id, context?.sandboxId);
  if (external.liveMode != null) match('checkout.live_mode', false, external.liveMode);
  if (external.sandboxId != null) match('checkout.sandbox', co.sandbox_id, external.sandboxId);
  match('asociacion.residente', Number(co.id_residente), Number(local.residentId));
  match('asociacion.usuario', Number(co.id_usuario), Number(local.residentUserId));
  match('asociacion.casa', Number(co.id_casa), Number(local.quotaHouseId));
  if (local.refunds.length || tr?.estado.startsWith('REEMBOLSADA')) return result('PENDIENTE', 'REEMBOLSO_REQUIERE_HU18');
  if (!tr) {
    if (external.status === 'paid') differences.push({ codigo: 'PAGO_LOCAL_AUSENTE', campo: 'PAGO', interno: null, externo: 'paid' });
    if (differences.length) return result('DIFERENCIA');
    return result('PENDIENTE', 'SIN_INTENTO_LOCAL');
  }
  match('intent.id', tr.id_externo, remote.id);
  match('intent.tipo', 'payment', remote.type);
  match('intent.checkout', co.id_externo, remote.checkout?.id);
  match('intent.monto_centavos', Number(tr.monto_centavos), remote.amount);
  match('intent.moneda', tr.moneda, remote.currency);
  match('intent.ambiente', tr.ambiente, context?.environment);
  match('intent.cuota', Number(co.id_cuota), Number(tr.id_cuota));
  match('intent.usuario', Number(co.id_usuario), Number(tr.id_usuario));
  match('intent.casa', Number(co.id_casa), Number(tr.id_casa));
  if (remote.liveMode != null) match('intent.live_mode', false, remote.liveMode);
  if (remote.sandboxId != null) match('intent.sandbox', co.sandbox_id, remote.sandboxId);
  if (remote.checkout?.liveMode != null) match('intent.checkout.live_mode', false, remote.checkout.liveMode);
  if (remote.checkout?.sandboxId != null) match('intent.checkout.sandbox', co.sandbox_id, remote.checkout.sandboxId);
  // A provider checkout can itself change between the two GETs.
  if (remote.checkout?.status != null && remote.checkout.status !== external.status) return result('PENDIENTE', 'CAMBIO_DURANTE_VERIFICACION_EXTERNA');
  if (remote.checkout?.amount != null) match('intent.checkout.monto_centavos', external.amount, remote.checkout.amount);
  if (remote.checkout?.currency != null) match('intent.checkout.moneda', external.currency, remote.checkout.currency);
  if (remote.createdAt && tr.fecha_proveedor_original) {
    match('intent.timestamp', paymentTime(tr.fecha_proveedor_original)?.utc, paymentTime(remote.createdAt)?.utc);
  }
  if (!remote.status) missing.push('intent.estado');
  const expected = { succeeded: 'CONFIRMADA', failed: 'FALLIDA', canceled: 'CANCELADA', pending: 'PENDIENTE' }[remote.status];
  if (expected) match('transaccion.estado', tr.estado, expected);
  if (remote.status === 'succeeded') {
    match('checkout.pagado', 'paid', external.status);
    match('checkout.estado_local', 'CONFIRMADO', co.estado);
    if (!pg || !tr.id_pago) differences.push({ codigo: 'PAGO_LOCAL_AUSENTE', campo: 'PAGO', interno: null, externo: 'succeeded' });
    else {
      match('pago.id', Number(tr.id_pago), Number(pg.id_pago));
      match('pago.cuota', Number(tr.id_cuota), Number(pg.id_cuota));
      match('pago.origen', 'RECURRENTE', pg.origen);
      match('pago.ambiente', tr.ambiente, pg.ambiente);
      let amount; try { amount = toCents(pg.monto_pagado); } catch { amount = null; }
      match('pago.monto_centavos', Number(tr.monto_centavos), amount);
      match('pago.referencia_externa', tr.id_pago_externo, external.paymentId);
      if (remote.createdAt) match('pago.fecha_contable', officialDate(remote.createdAt), pg.fecha_pago);
      if (!tr.confirmado_en || tr.capital_aplicado_centavos == null || tr.recargo_aplicado_centavos == null) missing.push('aplicacion_financiera');
      else match('aplicacion.centavos', Number(tr.monto_centavos), Number(tr.capital_aplicado_centavos) + Number(tr.recargo_aplicado_centavos));
    }
  } else if (['failed', 'canceled'].includes(remote.status)) {
    if (pg || tr.id_pago || tr.confirmado_en || tr.capital_aplicado_centavos != null || tr.recargo_aplicado_centavos != null) {
      differences.push({ codigo: 'INTENTO_NEGATIVO_CON_APLICACION', campo: 'PAGO', interno: tr.id_pago ?? 'aplicacion', externo: null });
    }
  } else if (remote.status && (tr.id_pago || pg)) differences.push({ codigo: 'PAGO_SIN_EXITO_EXTERNO', campo: 'PAGO', interno: tr.id_pago, externo: remote.status });
  if (differences.length) return result('DIFERENCIA');
  if (missing.length) return result('PENDIENTE', 'EVIDENCIA_INCOMPLETA');
  if (remote.status === 'pending' || external.status === 'payment_in_progress') return result('PENDIENTE', 'OPERACION_EN_PROGRESO');
  if (!['succeeded', 'failed', 'canceled'].includes(remote.status)) return result('PENDIENTE', 'SIN_DESENLACE');
  return result('CONCILIADA');
}
module.exports = { compareOperation, officialDate, RESULTS };
