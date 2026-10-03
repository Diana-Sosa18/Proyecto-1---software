const { randomUUID } = require("node:crypto");
const { pool: defaultPool } = require("../database/mysql");
const { calculateBalance, assertCollectible, toCents } = require("./financialBalance");
const { createRecurrenteClient } = require("./recurrenteClient");
const { CheckoutError } = require("./recurrenteCheckoutErrors");
const { BLOCKING_CHECKOUT_CONDITION } = require("./recurrenteCheckoutGuard");
const { validateCheckoutUrl } = require("../utils/recurrenteCheckoutUrl");

async function lockedQuota(connection, userId, quotaId) {
  const [rows] = await connection.execute(`SELECT cu.id_cuota, cu.id_casa, cu.monto,
      r.id_residente, srv.nombre concepto
    FROM CUOTA cu INNER JOIN CASA c ON c.id_casa = cu.id_casa
    INNER JOIN RESIDENTE r ON r.id_residente = c.id_residente AND r.id_usuario = ?
    INNER JOIN USUARIO u ON u.id_usuario = r.id_usuario AND u.activo = TRUE
    INNER JOIN TIPO_USUARIO tu ON tu.id_tipo_usuario = u.id_tipo_usuario AND LOWER(tu.nombre) = 'residente'
    INNER JOIN SERVICIO srv ON srv.id_servicio = cu.id_servicio
    WHERE cu.id_cuota = ? FOR UPDATE`, [userId, quotaId]);
  if (!rows.length) {
    const [exists] = await connection.execute("SELECT id_cuota FROM CUOTA WHERE id_cuota = ?", [quotaId]);
    throw new CheckoutError(exists.length ? "QUOTA_NOT_OWNED" : "QUOTA_NOT_FOUND");
  }
  // All applied payments, after the quota lock, without any movement-date filter.
  const [totals] = await connection.execute(`SELECT
    COALESCE((SELECT SUM(monto_recargo) FROM RECARGO_APLICADO WHERE id_cuota = ?),0) recargo,
    COALESCE((SELECT SUM(monto_pagado) FROM PAGO WHERE id_cuota = ?),0) pagado`, [quotaId, quotaId]);
  let balance;
  try { balance = calculateBalance({ ...rows[0], ...totals[0] }); assertCollectible(balance); }
  catch (error) { throw new CheckoutError(error.code === "FINANCIAL_OVERPAYMENT" ? error.code : "INVALID_FINANCIAL_AMOUNT"); }
  return { ...rows[0], balance };
}

function compatible(local, quota, userId, sandboxId) {
  return Number(local.id_cuota) === Number(quota.id_cuota) && Number(local.id_usuario) === Number(userId)
    && Number(local.id_residente) === Number(quota.id_residente) && Number(local.id_casa) === Number(quota.id_casa)
    && local.ambiente === "sandbox" && local.sandbox_id === sandboxId && local.moneda === "GTQ"
    && Number(local.monto_centavos) === toCents(quota.balance.saldo)
    && Number(local.capital_centavos) === toCents(quota.balance.capital_pendiente)
    && Number(local.recargo_centavos) === toCents(quota.balance.recargo_pendiente);
}

function createCheckoutService({ pool = defaultPool, client = createRecurrenteClient() } = {}) {
  async function insertLocal(connection, quota, userId, sandboxId) {
    const local = { referencia_local: randomUUID(), idempotency_key: randomUUID(), id_cuota: quota.id_cuota,
      id_usuario: userId, id_residente: quota.id_residente, id_casa: quota.id_casa,
      monto_centavos: toCents(quota.balance.saldo), capital_centavos: toCents(quota.balance.capital_pendiente),
      recargo_centavos: toCents(quota.balance.recargo_pendiente), moneda: "GTQ", ambiente: "sandbox",
      sandbox_id: sandboxId, concepto: quota.concepto };
    const [result] = await connection.execute(`INSERT INTO CHECKOUT_RECURRENTE
      (referencia_local,idempotency_key,id_cuota,id_usuario,id_residente,id_casa,monto_centavos,
       capital_centavos,recargo_centavos,moneda,ambiente,sandbox_id,estado)
      VALUES(?,?,?,?,?,?,?,?,?,'GTQ','sandbox',?,'CREADO')`,
    [local.referencia_local, local.idempotency_key, local.id_cuota, userId, local.id_residente, local.id_casa,
      local.monto_centavos, local.capital_centavos, local.recargo_centavos, sandboxId]);
    local.id_checkout = result.insertId;
    return { local, reused: false, marker: "CHECKOUT_CREATING" };
  }
  async function reserve(userId, quotaId, sandboxId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const quota = await lockedQuota(connection, userId, quotaId);
      const amount = toCents(quota.balance.saldo);
      if (!amount) throw new CheckoutError("QUOTA_PAID");
      if (amount < 500) throw new CheckoutError("CHECKOUT_MINIMUM");
      const [active] = await connection.execute(`SELECT id_checkout, referencia_local, id_externo,
        id_cuota, id_usuario, id_residente, id_casa, monto_centavos, capital_centavos, recargo_centavos,
        moneda, ambiente, sandbox_id, estado, checkout_url, estado_proveedor
        FROM CHECKOUT_RECURRENTE WHERE id_cuota = ? AND ${BLOCKING_CHECKOUT_CONDITION}
        ORDER BY id_checkout FOR UPDATE`, [quotaId]);
      if (active.some((row) => row.estado === "INCIERTO")) throw new CheckoutError("CHECKOUT_UNCERTAIN");
      if (active.length > 1) throw new CheckoutError("CHECKOUT_INCOMPATIBLE");
      if (active.length) {
        const local = active[0];
        if (!compatible(local, quota, userId, sandboxId)) throw new CheckoutError("CHECKOUT_INCOMPATIBLE");
        if (local.estado === "CREADO") throw new CheckoutError("CHECKOUT_IN_PROGRESS");
        if (!validateCheckoutUrl(local.checkout_url, local.id_externo)) {
          throw new CheckoutError("CHECKOUT_NOT_USABLE");
        }
        // Write ahead of GET too: loss of the response/process never permits automatic recovery.
        await connection.execute("UPDATE CHECKOUT_RECURRENTE SET estado='INCIERTO',error_codigo='CHECKOUT_VERIFYING' WHERE id_checkout=?", [local.id_checkout]);
        await connection.commit();
        return { local, reused: true, marker: "CHECKOUT_VERIFYING" };
      }
      const operation = await insertLocal(connection, quota, userId, sandboxId);
      await connection.commit();
      return operation;
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }
  async function sending(local) {
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.execute("UPDATE CHECKOUT_RECURRENTE SET estado='INCIERTO',error_codigo='CHECKOUT_CREATING' WHERE id_checkout=? AND estado='CREADO'", [local.id_checkout]);
      if (result.affectedRows !== 1) throw new CheckoutError("CHECKOUT_UNCERTAIN");
    } finally { connection.release(); }
  }
  async function failure(operation, error, metadata = error.checkout) {
    if (operation.reused) metadata = null; // Never replace an already bound external ID with an invalid GET response.
    const connection = await pool.getConnection();
    try {
      const state = operation.reused || error.uncertain ? "INCIERTO" : "FALLIDO";
      try {
        await connection.execute(`UPDATE CHECKOUT_RECURRENTE SET estado=?,error_codigo=?,
          id_externo=COALESCE(id_externo,?),checkout_url=COALESCE(checkout_url,?),
          estado_proveedor=COALESCE(?,estado_proveedor)
          WHERE id_checkout=? AND estado IN ('CREADO','INCIERTO')`,
        [state, error.code, metadata?.id_externo || null, metadata?.checkout_url || null,
          metadata?.estado_proveedor || null, operation.local.id_checkout]);
      } catch {
        // A conflict saving returned identifiers must never reopen the obligation.
        await connection.execute("UPDATE CHECKOUT_RECURRENTE SET estado='INCIERTO',error_codigo='CHECKOUT_PERSISTENCE' WHERE id_checkout=? AND estado IN ('CREADO','INCIERTO')", [operation.local.id_checkout]);
        throw new CheckoutError("CHECKOUT_PERSISTENCE", { uncertain: true });
      }
    } finally { connection.release(); }
  }
  async function finish(operation, metadata, userId, sandboxId) {
    const { local, marker } = operation;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const quota = await lockedQuota(connection, userId, local.id_cuota);
      const conflict = !compatible(local, quota, userId, sandboxId) ? "CHECKOUT_INCOMPATIBLE"
        : metadata.estado_proveedor !== "unpaid" ? "CHECKOUT_NOT_USABLE" : null;
      const [result] = await connection.execute(`UPDATE CHECKOUT_RECURRENTE
        SET id_externo=?,checkout_url=?,estado_proveedor=?,estado='PENDIENTE',error_codigo=?
        WHERE id_checkout=? AND estado='INCIERTO' AND error_codigo=?`,
      [metadata.id_externo, metadata.checkout_url, metadata.estado_proveedor, conflict, local.id_checkout, marker]);
      if (result.affectedRows !== 1) throw new CheckoutError("CHECKOUT_UNCERTAIN");
      await connection.commit();
      return { conflict, result: { referencia_local: local.referencia_local, checkout_url: metadata.checkout_url } };
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }
  async function runOperation(operation, userId, sandboxId) {
    let metadata;
    try {
      metadata = operation.reused ? await client.getCheckout(operation.local)
        : await client.createCheckout(operation.local, () => sending(operation.local));
    } catch (error) {
      const safe = error instanceof CheckoutError ? error : new CheckoutError("CHECKOUT_PERSISTENCE", { uncertain: true });
      try { await failure(operation, safe); }
      catch { throw new CheckoutError("CHECKOUT_PERSISTENCE", { uncertain: true }); }
      throw safe;
    }
    let outcome;
    try { outcome = await finish(operation, metadata, userId, sandboxId); }
    catch (error) {
      const safe = error instanceof CheckoutError ? error : new CheckoutError("CHECKOUT_PERSISTENCE", { uncertain: true });
      // The checkout already exists even when its last SQL update fails.
      safe.uncertain = true;
      try { await failure(operation, safe, metadata); }
      catch { throw new CheckoutError("CHECKOUT_PERSISTENCE", { uncertain: true }); }
      throw safe;
    }
    if (outcome.conflict) throw new CheckoutError(outcome.conflict);
    return outcome.result;
  }
  async function startResidentCheckout(userId, quotaId) {
    if (!Number.isSafeInteger(quotaId) || quotaId <= 0 || quotaId > 2147483647) throw new CheckoutError("INVALID_QUOTA");
    const sandboxId = client.sandboxId(); // Configuration only: no request before ownership/balance checks.
    return runOperation(await reserve(userId, quotaId, sandboxId), userId, sandboxId);
  }
  return { startResidentCheckout };
}
module.exports = { createCheckoutService };
