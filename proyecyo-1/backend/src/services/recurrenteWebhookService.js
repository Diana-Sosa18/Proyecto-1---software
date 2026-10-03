const { createHash } = require("node:crypto");
const { pool: defaultPool } = require("../database/mysql");
const { calculateBalance, assertCollectible, toCents } = require("./financialBalance");
const { safeError } = require("./recurrenteWebhookPayload");
const terminal = ["PROCESADO", "IGNORADO", "REVISION"];
const legacyIgnoreCodes = ["WEBHOOK_UNSUPPORTED_EVENT", "WEBHOOK_ENVIRONMENT_MISMATCH"];
const money = (cents) => `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;

function createWebhookService({ pool = defaultPool } = {}) {
  async function receive({ svixId, hash, event, sandboxId }) {
    let c;
    try { c = await pool.getConnection(); }
    catch { throw safeError("WEBHOOK_RETRY", 503); }
    let inbox, inTransaction = false, reprocessLegacy = false;
    try {
      // Commit receipt separately so rollback never loses the inbox. A transient
      // failure still returns 503; a durable receipt alone is not fulfillment.
      await c.execute(`INSERT INTO EVENTO_RECURRENTE
        (svix_id,ambiente,tipo_evento,id_operacion_externa,hash_body,sandbox_id,live_mode)
        VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE id_evento=id_evento`,
      [svixId, event.environment, event.eventType, event.sourceId || event.externalId, hash, event.sandboxId, event.liveMode]);
      // A quota lock waiter must see payments committed while it waited, rather
      // than a REPEATABLE READ snapshot created by the checkout lookup.
      await c.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
      await c.beginTransaction(); inTransaction = true;
      const [events] = await c.execute("SELECT * FROM EVENTO_RECURRENTE WHERE ambiente=? AND svix_id=? FOR UPDATE", [event.environment, svixId]);
      inbox = events[0];
      if (!inbox || inbox.hash_body !== hash) throw safeError("WEBHOOK_EVENT_CONFLICT", 409);
      // Only a freshly authenticated, identical body that now satisfies every
      // payment check can recover the two known pre-contract ignore reasons.
      // Never bulk-edit old inbox rows, reopen PROCESADO/REVISION, or replay on a timer.
      reprocessLegacy = inbox.estado === "IGNORADO" && legacyIgnoreCodes.includes(inbox.error_codigo)
        && ["payment_intent.succeeded", "intent.succeeded"].includes(inbox.tipo_evento)
        && inbox.tipo_evento === event.eventType && event.disposition === "PAYMENT";
      if (terminal.includes(inbox.estado) && !reprocessLegacy) {
        await c.commit(); inTransaction = false;
        return inbox.estado === "PROCESADO" ? "duplicate" : inbox.estado === "REVISION" ? "review" : "ignored";
      }
      await c.execute(`UPDATE EVENTO_RECURRENTE SET estado='PROCESANDO',intentos=intentos+1,error_codigo=NULL,
        error_sanitizado=NULL,sandbox_id=?,live_mode=? WHERE id_evento=?`, [event.sandboxId, event.liveMode, inbox.id_evento]);
      async function complete(state, code = null) {
        await c.execute(`UPDATE EVENTO_RECURRENTE SET estado=?,error_codigo=?,error_sanitizado=NULL,
          procesado_en=NOW(6),proximo_reintento_en=NULL WHERE id_evento=?`, [state, code, inbox.id_evento]);
        await c.commit(); inTransaction = false;
        return state === "PROCESADO" ? "processed" : state === "REVISION" ? "review" : "ignored";
      }
      if (event.disposition !== "PAYMENT") return await complete(event.disposition, event.code);

      const [refs] = await c.execute("SELECT id_checkout,id_cuota FROM CHECKOUT_RECURRENTE WHERE ambiente='sandbox' AND id_externo=?", [event.checkoutId]);
      if (!refs[0]) {
        // A signed event can outrun HU13's persistence of the external checkout ID.
        // Do not bind an unknown checkout from metadata; let Svix retry safely.
        throw safeError("WEBHOOK_CHECKOUT_NOT_READY", 503);
      }
      // Same lock order as HU13 and academic payments: quota, then checkout.
      // Lock the parent before any consistent reads of PAGO to serialize balances.
      const [quotas] = await c.execute(`SELECT cu.id_cuota,cu.id_casa,cu.monto,r.id_residente,r.id_usuario
        FROM CUOTA cu JOIN CASA ca ON ca.id_casa=cu.id_casa
        JOIN RESIDENTE r ON r.id_residente=ca.id_residente WHERE cu.id_cuota=? FOR UPDATE`, [refs[0].id_cuota]);
      const [checkouts] = await c.execute("SELECT * FROM CHECKOUT_RECURRENTE WHERE id_checkout=? FOR UPDATE", [refs[0].id_checkout]);
      const local = checkouts[0], quota = quotas[0];
      if (!local || !quota || Number(local.id_cuota) !== Number(quota.id_cuota)
        || Number(local.id_casa) !== Number(quota.id_casa) || Number(local.id_residente) !== Number(quota.id_residente)
        || Number(local.id_usuario) !== Number(quota.id_usuario)
        || local.ambiente !== "sandbox" || local.sandbox_id !== sandboxId
        || (event.reference !== undefined && event.reference !== local.referencia_local)) {
        return await complete("REVISION", "WEBHOOK_ASSOCIATION_MISMATCH");
      }
      if (local.moneda !== "GTQ" || local.moneda !== event.currency) return await complete("REVISION", "WEBHOOK_CURRENCY_MISMATCH");
      if (Number(local.monto_centavos) !== event.amount) return await complete("REVISION", "WEBHOOK_AMOUNT_MISMATCH");


      const [transactions] = await c.execute(`SELECT * FROM TRANSACCION_RECURRENTE
        WHERE ambiente='sandbox' AND (id_externo=? OR (? IS NOT NULL AND id_pago_externo=?)) FOR UPDATE`,
      [event.externalId, event.paymentId, event.paymentId]);
      let transaction = transactions[0];
      if (transactions.length > 1 || (transaction && (transaction.id_externo !== event.externalId
        || Number(transaction.id_checkout) !== Number(local.id_checkout)
        || Number(transaction.id_cuota) !== Number(local.id_cuota)
        || Number(transaction.id_usuario) !== Number(local.id_usuario) || Number(transaction.id_casa) !== Number(local.id_casa)
        || Number(transaction.monto_centavos) !== event.amount || transaction.moneda !== event.currency
        || (transaction.id_pago_externo && transaction.id_pago_externo !== event.paymentId)
        || (transaction.fecha_proveedor_original && transaction.fecha_proveedor_original !== event.time.original)))) {
        return await complete("REVISION", "WEBHOOK_TRANSACTION_MISMATCH");
      }
      if (transaction?.id_pago) {
        const [payments] = await c.execute(`SELECT DATE_FORMAT(p.fecha_pago,'%Y-%m-%d') fecha_pago,p.monto_pagado,o.origen,o.ambiente FROM PAGO p
          JOIN PAGO_ORIGEN o ON o.id_pago=p.id_pago WHERE p.id_pago=? AND p.id_cuota=?`, [transaction.id_pago, local.id_cuota]);
        if (transaction.estado !== "CONFIRMADA" || local.estado !== "CONFIRMADO" || payments[0]?.origen !== "RECURRENTE"
          || payments[0]?.ambiente !== "sandbox" || payments[0]?.fecha_pago !== event.time.accountingDate
          || toCents(payments[0]?.monto_pagado) !== event.amount) {
          return await complete("REVISION", "WEBHOOK_TRANSACTION_MISMATCH");
        }
        await complete("PROCESADO"); return "duplicate";
      }
      if (!["CREADO", "PENDIENTE", "INCIERTO"].includes(local.estado)
        || (transaction && transaction.estado !== "PENDIENTE")) return await complete("REVISION", "WEBHOOK_CHECKOUT_STATE_MISMATCH");
      const [otherTransactions] = await c.execute("SELECT id_transaccion FROM TRANSACCION_RECURRENTE WHERE id_checkout=? AND id_pago IS NOT NULL FOR UPDATE", [local.id_checkout]);
      if (otherTransactions.length) return await complete("REVISION", "WEBHOOK_CHECKOUT_ALREADY_PAID");

      const [totals] = await c.execute(`SELECT
        COALESCE((SELECT SUM(monto_recargo) FROM RECARGO_APLICADO WHERE id_cuota=?),0) recargo,
        COALESCE((SELECT SUM(monto_pagado) FROM PAGO WHERE id_cuota=?),0) pagado`, [local.id_cuota, local.id_cuota]);
      let before;
      try { before = calculateBalance({ ...quota, ...totals[0] }); assertCollectible(before); }
      catch { return await complete("REVISION", "WEBHOOK_HISTORICAL_OVERPAYMENT"); }
      if (event.amount > toCents(before.saldo)) return await complete("REVISION", "WEBHOOK_OVERPAYMENT");
      const paidCents = toCents(before.pagado) + event.amount;
      if (!Number.isSafeInteger(paidCents)) return await complete("REVISION", "WEBHOOK_AMOUNT_STORAGE_LIMIT");
      const after = calculateBalance({ monto: quota.monto, recargo: totals[0].recargo, pagado: money(paidCents) });
      const capital = toCents(before.capital_pendiente) - toCents(after.capital_pendiente);
      const surcharge = toCents(before.recargo_pendiente) - toCents(after.recargo_pendiente);
      // PAGO, its source, canonical transaction, checkout and inbox commit together.
      const [payment] = await c.execute("INSERT INTO PAGO(id_cuota,monto_pagado,fecha_pago) VALUES(?,?,?)", [local.id_cuota, money(event.amount), event.time.accountingDate]);
      await c.execute("INSERT INTO PAGO_ORIGEN(id_pago,id_cuota,origen,ambiente) VALUES(?,?,'RECURRENTE','sandbox')", [payment.insertId, local.id_cuota]);
      const audit = [payment.insertId, event.paymentId, inbox.id_evento, event.time.utc, event.time.original, capital, surcharge];
      if (transaction) {
        await c.execute(`UPDATE TRANSACCION_RECURRENTE SET id_pago=?,id_pago_externo=?,id_evento=?,fecha_proveedor_utc=?,
          fecha_proveedor_original=?,capital_aplicado_centavos=?,recargo_aplicado_centavos=?,estado='CONFIRMADA',confirmado_en=NOW(6)
          WHERE id_transaccion=?`, [...audit, transaction.id_transaccion]);
      } else {
        const idempotencyKey = createHash("sha256").update(`sandbox:intent:${event.externalId}`).digest("hex");
        await c.execute(`INSERT INTO TRANSACCION_RECURRENTE
          (id_checkout,id_externo,idempotency_key,id_cuota,id_usuario,id_casa,monto_centavos,moneda,ambiente,
           id_pago,id_pago_externo,id_evento,fecha_proveedor_utc,fecha_proveedor_original,capital_aplicado_centavos,
           recargo_aplicado_centavos,estado,confirmado_en)
          VALUES(?,?,?,?,?,?,?,'GTQ','sandbox',?,?,?,?,?,?,?,'CONFIRMADA',NOW(6))`,
        [local.id_checkout, event.externalId, idempotencyKey, local.id_cuota, local.id_usuario, local.id_casa, event.amount, ...audit]);
      }
      await c.execute("UPDATE CHECKOUT_RECURRENTE SET estado='CONFIRMADO',estado_proveedor='paid',error_codigo=NULL WHERE id_checkout=?", [local.id_checkout]);
      return await complete("PROCESADO");
    } catch (error) {
      if (inTransaction) await c.rollback().catch(() => {});
      if (inbox && error.code !== "WEBHOOK_EVENT_CONFLICT") {
        // Never overwrite a concurrent successful retry. No arbitrary SQL errors,
        // body or headers persisted. Receipt survives; financial effects do not.
        const code = error.code === "WEBHOOK_CHECKOUT_NOT_READY" ? error.code : "WEBHOOK_RETRY";
        await c.execute(`UPDATE EVENTO_RECURRENTE SET estado='FALLIDO',intentos=intentos+1,error_codigo=?,
          error_sanitizado=NULL,procesado_en=NULL WHERE id_evento=? AND
          (estado NOT IN ('PROCESADO','IGNORADO','REVISION') OR
            (? AND estado='IGNORADO' AND error_codigo IN ('WEBHOOK_UNSUPPORTED_EVENT','WEBHOOK_ENVIRONMENT_MISMATCH')))`,
        [code, inbox.id_evento, reprocessLegacy]).catch(() => {});
      }
      if (["WEBHOOK_EVENT_CONFLICT", "WEBHOOK_CHECKOUT_NOT_READY"].includes(error.code)) throw error;
      throw safeError("WEBHOOK_RETRY", 503);
    } finally { c.release(); }
  }
  return { receive };
}
module.exports = { createWebhookService };
