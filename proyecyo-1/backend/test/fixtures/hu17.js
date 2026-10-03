// Deliberately fictitious provider context; never reads backend/.env.
const context = { environment: 'sandbox', sandboxId: 'sbx_HU17_FIXTURE', accountId: 'ac_HU17_FIXTURE' };
function fixture(status = 'succeeded') {
  const succeeded = status === 'succeeded';
  const local = { key: 'intent:296', checkout: { id_checkout: 433, referencia_local: 'hu17-fixture', id_externo: 'ch_HU17_FIXTURE', id_cuota: 171,
    id_usuario: 3, id_residente: 1, id_casa: 1, monto_centavos: 500, moneda: 'GTQ', ambiente: 'sandbox', estado: succeeded ? 'CONFIRMADO' : 'PENDIENTE',
    estado_proveedor: succeeded ? 'paid' : 'unpaid', sandbox_id: context.sandboxId, verificado_en: null, actualizado_en: '2026-10-02 18:00:00' },
    intent: { id_transaccion: 296, id_externo: 'in_HU17_FIXTURE', id_pago_externo: 'pa_HU17_FIXTURE', id_pago: succeeded ? 395 : null,
      id_cuota: 171, id_usuario: 3, id_casa: 1, monto_centavos: 500, moneda: 'GTQ', ambiente: 'sandbox',
      estado: { succeeded: 'CONFIRMADA', failed: 'FALLIDA', canceled: 'CANCELADA', pending: 'PENDIENTE' }[status],
      fecha_proveedor_original: '2026-10-03T01:00:00Z', confirmado_en: succeeded ? '2026-10-03 01:00:01' : null,
      capital_aplicado_centavos: succeeded ? 500 : null, recargo_aplicado_centavos: succeeded ? 0 : null,
      motivo_codigo: null, motivo_sanitizado: null, actualizado_en: '2026-10-03 01:00:01' },
    payment: succeeded ? { id_pago: 395, id_cuota: 171, monto_pagado: '5.00', fecha_pago: '2026-10-02', origen: 'RECURRENTE', ambiente: 'sandbox' } : null,
    residentId: 1, residentUserId: 3, quotaHouseId: 1, residentName: 'TEST resident', unit: 'B-302', concept: 'HU17 TEST',
    balance: { saldo: succeeded ? '0.00' : '5.00', pagado: succeeded ? '5.00' : '0.00', recargo: '0.00', sobrepago: '0.00' }, events: [], refunds: [] };
  const checkout = { id: local.checkout.id_externo, status: local.checkout.estado_proveedor, amount: 500, currency: 'GTQ', liveMode: false,
    sandboxId: context.sandboxId, createdAt: '2026-10-02T18:00:00Z', latestIntentId: local.intent.id_externo, paymentId: succeeded ? local.intent.id_pago_externo : null };
  const intent = { id: local.intent.id_externo, type: 'payment', status, amount: 500, currency: 'GTQ', liveMode: false, sandboxId: context.sandboxId,
    createdAt: local.intent.fecha_proveedor_original, checkout: { ...checkout }, reason: null };
  return { local, observation: { context: { ...context }, checkout, intent } };
}
module.exports = { fixture, context };
