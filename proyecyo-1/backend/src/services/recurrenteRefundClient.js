const { API_BASE, getCheckoutConfig } = require('../config/recurrenteCheckout');
const { createRecurrenteReadClient } = require('./recurrenteReadClient');
const { paymentTime } = require('./recurrenteWebhookPayload');
const { RefundError, normalizeRefund, providerId } = require('./recurrenteRefundContract');

function createRecurrenteRefundClient({ fetchImpl = (...a) => globalThis.fetch(...a), configuration = getCheckoutConfig, now = () => new Date() } = {}) {
  const reader = createRecurrenteReadClient({ fetchImpl, configuration });
  async function open(local) {
    const config = configuration();
    // Capture one configuration for the entire operation, including secret rotation.
    const session = await createRecurrenteReadClient({ fetchImpl, configuration: () => config }).open();
    const [intent, checkout] = await Promise.all([session.getIntent(local.id_externo), session.getCheckout(local.checkout_externo)]);
    const time = paymentTime(intent.createdAt), age = time && now().getTime() - new Date(time.original).getTime();
    if (local.ambiente !== 'sandbox' || local.sandbox_id !== session.context.sandboxId || local.moneda !== 'GTQ'
      || intent.id !== local.id_externo || intent.type !== 'payment' || intent.status !== 'succeeded'
      || intent.amount !== Number(local.monto_centavos) || intent.currency !== 'GTQ'
      || intent.checkout?.id !== local.checkout_externo || checkout.id !== local.checkout_externo || checkout.status !== 'paid'
      || checkout.amount !== Number(local.checkout_monto) || checkout.currency !== 'GTQ'
      || checkout.paymentId !== local.id_pago_externo || checkout.latestIntentId !== local.id_externo
      || [intent, intent.checkout, checkout].some(v => v?.liveMode === true || v?.sandboxId != null && v.sandboxId !== config.sandboxId)
      || !time || age < 0 || age > 30 * 86400000) {
      throw new RefundError('REFUND_EXTERNAL_EVIDENCE', 409);
    }
    return { context: session.context, async send(localRefund, onSending) {
      if (!providerId(local.id_externo, 'in')) throw new RefundError('REFUND_EXTERNAL_EVIDENCE');
      await onSending(); // Committed write-ahead marker; no SQL locks while performing HTTP.
      const controller = new AbortController(); let timer;
      const timeout = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new RefundError('REFUND_UNKNOWN', 504, { uncertain: true })); }, config.timeoutMs); });
      async function operation() {
        const response = await fetchImpl(`${API_BASE}/refunds`, { method: 'POST', redirect: 'error', signal: controller.signal,
          headers: { 'X-SECRET-KEY': config.secretKey, 'Content-Type': 'application/json', Accept: 'application/json', 'Idempotency-Key': localRefund.idempotency_key },
          body: JSON.stringify({ intent_id: local.id_externo }) });
        // A 422 may reference an already-created refund. Preserve only a valid reference,
        // but never interpret rejection, 202 or unknown outcome as successful accounting.
        const retryable = response.status >= 500 || response.status === 202;
        let data = null;
        if (/^application\/(?:[a-z0-9.+-]+\+)?json(?:;|$)/i.test(response.headers.get('content-type') || '')) {
          const chunks = []; let size = 0;
          if (response.body?.getReader) { const r = response.body.getReader(); while (true) { const n = await r.read(); if (n.done) break; size += n.value.byteLength; if (size > 1048576) { await r.cancel(); throw new RefundError('REFUND_UNKNOWN', 502, { uncertain: true }); } chunks.push(Buffer.from(n.value)); } }
          else { const value = await response.text(); if (Buffer.byteLength(value) > 1048576) throw new RefundError('REFUND_UNKNOWN', 502, { uncertain: true }); chunks.push(Buffer.from(value)); }
          try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { /* No raw provider data in errors. */ }
        } else { await response.body?.cancel().catch(() => {}); }
        if (response.status !== 200 && response.status !== 202) {
          const reference = providerId(data?.refund_id, 're') ? { id: data.refund_id } : null;
          const unknown = retryable || !!reference || data?.failure_reason === 'provider_outcome_unknown'
            || ![400, 401, 403, 404, 422, 429].includes(response.status);
          throw new RefundError(unknown ? 'REFUND_UNKNOWN' : 'REFUND_PROVIDER_REJECTED', 502, { uncertain: unknown, refund: reference });
        }
        const refund = normalizeRefund(data, paymentTime);
        if (response.status === 202 || refund.reason === 'PROVIDER_OUTCOME_UNKNOWN') refund.status = 'pending';
        return refund;
      }
      try { return await Promise.race([operation(), timeout]); }
      catch (e) { throw e instanceof RefundError ? e : new RefundError('REFUND_UNKNOWN', 503, { uncertain: true }); }
      finally { clearTimeout(timer); controller.abort(); }
    } };
  }
  return { sandboxId: () => configuration().sandboxId, open,
    async getRefund(externalId) { const session = await reader.open(); return { refund: await session.getRefund(externalId), context: session.context }; } };
}
module.exports = { createRecurrenteRefundClient };
