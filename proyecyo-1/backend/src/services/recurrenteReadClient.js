const { API_BASE, getCheckoutConfig } = require('../config/recurrenteCheckout');
const { paymentTime } = require('./recurrenteWebhookPayload');
const { failureReason } = require('./recurrenteAttemptPayload');

const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const id = (v, prefix) => typeof v === 'string' && new RegExp(`^${prefix}_[A-Za-z0-9_-]{1,180}$`).test(v);
class VerificationError extends Error {
  constructor(code) { super('No fue posible verificar la operación con Recurrente.'); this.code = code; }
}
const invalid = () => { throw new VerificationError('RESPUESTA_INVALIDA'); };
function optional(v, valid) { if (v != null && !valid(v)) invalid(); return v ?? null; }
function checkout(v) {
  if (!object(v)) invalid();
  if (v.latest_intent != null && !object(v.latest_intent) || v.payment != null && !object(v.payment)) invalid();
  return {
    id: optional(v.id, x => id(x, 'ch')),
    status: optional(v.status, x => ['unpaid', 'paid', 'payment_in_progress', 'expired'].includes(x)),
    amount: optional(v.total_in_cents, x => Number.isSafeInteger(x) && x >= 0),
    currency: optional(v.currency, x => typeof x === 'string' && /^[A-Z]{3}$/.test(x)),
    liveMode: optional(v.live_mode, x => typeof x === 'boolean'),
    sandboxId: optional(v.sandbox_id, x => id(x, 'sbx')),
    createdAt: optional(v.created_at, x => !!paymentTime(x)),
    latestIntentId: optional(v.latest_intent?.id, x => id(x, 'in')),
    paymentId: optional(v.payment?.id, x => id(x, 'pa')),
  };
}
function intent(v) {
  if (!object(v)) invalid();
  const nested = v.checkout == null ? null : checkout(v.checkout);
  return {
    id: optional(v.id, x => id(x, 'in')),
    type: optional(v.type, x => ['payment', 'bank_transfer', 'crypto', 'balance', 'cash'].includes(x)),
    status: optional(v.status, x => ['pending', 'succeeded', 'failed', 'canceled', 'paid'].includes(x)),
    amount: optional(v.amount_in_cents, x => Number.isSafeInteger(x) && x >= 0),
    currency: optional(v.currency, x => typeof x === 'string' && /^[A-Z]{3}$/.test(x)),
    liveMode: optional(v.live_mode, x => typeof x === 'boolean'),
    sandboxId: optional(v.sandbox_id, x => id(x, 'sbx')),
    createdAt: optional(v.created_at, x => !!paymentTime(x)),
    checkout: nested,
    reason: v.status === 'failed' || v.status === 'canceled'
      ? failureReason(v.details?.failure_reason, v.status === 'canceled') : null,
  };
}

function createRecurrenteReadClient({ fetchImpl = (...args) => globalThis.fetch(...args), configuration = getCheckoutConfig, maxPages = 20 } = {}) {
  async function request(config, url) {
    const abort = new AbortController(); let timer;
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => { abort.abort(); reject(new VerificationError('TIMEOUT')); }, config.timeoutMs); });
    async function operation() {
      const r = await fetchImpl(url, { method: 'GET', redirect: 'error', signal: abort.signal,
        headers: { 'X-SECRET-KEY': config.secretKey, Accept: 'application/json' } });
      if (!r.ok) {
        await r.body?.cancel().catch(() => {});
        throw new VerificationError(r.status === 404 ? 'REFERENCIA_NO_LOCALIZADA'
          : [401, 403].includes(r.status) ? 'AUTENTICACION_PROVEEDOR'
            : r.status === 429 ? 'LIMITE_PROVEEDOR' : 'PROVEEDOR_NO_DISPONIBLE');
      }
      if (!/^application\/(?:[a-z0-9.+-]+\+)?json(?:;|$)/i.test(r.headers.get('content-type') || '')) invalid();
      const chunks = []; let size = 0;
      if (r.body?.getReader) {
        const reader = r.body.getReader();
        while (true) {
          const next = await reader.read(); if (next.done) break;
          size += next.value.byteLength;
          if (size > 1048576) { await reader.cancel(); invalid(); }
          chunks.push(Buffer.from(next.value));
        }
      } else { const text = await r.text(); if (Buffer.byteLength(text) > 1048576) invalid(); chunks.push(Buffer.from(text)); }
      let data; try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { invalid(); }
      return { data, headers: r.headers };
    }
    try { return await Promise.race([operation(), timeout]); }
    catch (e) { throw e instanceof VerificationError ? e : new VerificationError('PROVEEDOR_NO_DISPONIBLE'); }
    finally { clearTimeout(timer); abort.abort(); }
  }
  return {
    async open() {
      let config; try { config = configuration(); } catch { throw new VerificationError('NO_CONFIGURADO'); }
      const { data } = await request(config, `${API_BASE}/test`);
      if (!object(data) || data.environment !== 'sandbox' || data.sandbox_id !== config.sandboxId
        || !id(data.account_id, 'ac')) throw new VerificationError('CONTEXTO_SANDBOX_INVALIDO');
      // Bind the configuration to this verification, including during key rotation.
      const context = { environment: 'sandbox', sandboxId: config.sandboxId, accountId: data.account_id };
      async function list(resource, from, until) {
        if (!paymentTime(from) || !paymentTime(until) || new Date(from) > new Date(until)) throw new VerificationError('RANGO_INVALIDO');
        let url = new URL(`${API_BASE}/${resource}`);
        url.search = new URLSearchParams({ from_time: from, until_time: until, page: '1', items: '100' }).toString();
        const seen = new Set(), records = new Map(); let pages = 0;
        while (url && pages < maxPages) {
          if (seen.has(url.href)) return { records: [...records.values()], complete: false, pages, reason: 'PAGINACION_CICLICA' };
          seen.add(url.href);
          const response = await request(config, url.href); pages++;
          if (!Array.isArray(response.data)) invalid();
          for (const raw of response.data) {
            const record = resource === 'intents' ? intent(raw) : checkout(raw);
            if (!record.id) invalid();
            if (records.has(record.id) && JSON.stringify(records.get(record.id)) !== JSON.stringify(record)) {
              return { records: [...records.values()], complete: false, pages, reason: 'CAMBIO_DURANTE_EXPLORACION' };
            }
            records.set(record.id, record);
          }
          const link = response.headers.get('link');
          const next = link && link.split(',').find(v => /;\s*rel\s*=\s*"?next"?(?:\s*;|\s*$)/i.test(v));
          if (next) {
            const target = /<([^>]+)>/.exec(next)?.[1];
            try {
              const candidate = new URL(target, url);
              if (!target || candidate.origin !== new URL(API_BASE).origin || candidate.pathname !== `/api/${resource}`
                || candidate.username || candidate.password || candidate.hash
                || [...candidate.searchParams.keys()].some(k => !['page', 'items', 'from_time', 'until_time'].includes(k))
                || candidate.searchParams.get('from_time') !== from || candidate.searchParams.get('until_time') !== until
                || !/^[1-9]\d{0,5}$/.test(candidate.searchParams.get('page') || '')
                || ['page', 'items', 'from_time', 'until_time'].some(k => candidate.searchParams.getAll(k).length !== 1)
                || candidate.searchParams.get('items') !== '100') throw new Error();
              url = candidate;
            } catch { return { records: [...records.values()], complete: false, pages, reason: 'ENLACE_PAGINACION_INVALIDO' }; }
            continue;
          }
          const current = Number(response.headers.get('current-page')), total = Number(response.headers.get('total-pages'));
          if (Number.isInteger(current) && current === Number(url.searchParams.get('page')) && Number.isInteger(total) && total >= current) {
            if (current < total) { url.searchParams.set('page', String(current + 1)); continue; }
            const totalCount = response.headers.get('total-count');
            if (totalCount != null && (!/^\d+$/.test(totalCount) || Number(totalCount) !== records.size)) return { records: [...records.values()], complete: false, pages, reason: 'RECUENTO_INCONSISTENTE' };
            return { records: [...records.values()], complete: true, pages, reason: null };
          }
          if (link && /;\s*rel\s*=\s*"?last"?/i.test(link)) {
            const last = /<([^>]+)>\s*;\s*rel\s*=\s*"?last"?/i.exec(link)?.[1];
            try { if (last && new URL(last, url).href === url.href) return { records: [...records.values()], complete: true, pages, reason: null }; }
            catch { return { records: [...records.values()], complete: false, pages, reason: 'ENLACE_PAGINACION_INVALIDO' }; }
          }
          return { records: [...records.values()], complete: false, pages, reason: 'SIN_EVIDENCIA_DE_FIN' };
        }
        return { records: [...records.values()], complete: false, pages, reason: 'LIMITE_DE_PAGINAS' };
      }
      return { context,
        async getIntent(externalId) { if (!id(externalId, 'in')) throw new VerificationError('REFERENCIA_INVALIDA'); return intent((await request(config, `${API_BASE}/intents/${externalId}`)).data); },
        async getCheckout(externalId) { if (!id(externalId, 'ch')) throw new VerificationError('REFERENCIA_INVALIDA'); return checkout((await request(config, `${API_BASE}/checkouts/${externalId}`)).data); },
        discoverIntents: (from, until) => list('intents', from, until),
        discoverCheckouts: (from, until) => list('checkouts', from, until),
      };
    },
  };
}
module.exports = { createRecurrenteReadClient, VerificationError };
