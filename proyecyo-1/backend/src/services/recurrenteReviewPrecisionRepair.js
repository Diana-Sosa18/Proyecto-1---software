const { createHash } = require('node:crypto');
const { paymentTime } = require('./recurrenteWebhookPayload');
const digest = value => createHash('sha256').update(value).digest('hex');
const fail = () => { throw new Error('REVIEW_PRECISION_EVIDENCE_REJECTED'); };
function exactTimestamp(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6}$/.test(value)
    && !!paymentTime(value.replace(' ', 'T') + 'Z');
}
function truncatedMilliseconds(value) {
  if (!exactTimestamp(value)) fail();
  return value.slice(0, 23) + '000';
}
// Explicit operator-supplied original MySQL snapshot, not the current (overwritten)
// procesado_en, a provider timestamp or a guessed microsecond suffix.
function readEvidence(bytes, expectedHash, database) {
  if (!Buffer.isBuffer(bytes) || bytes.length > 16*1024*1024
    || !/^[a-f0-9]{64}$/.test(expectedHash || '') || digest(bytes) !== expectedHash) fail();
  let snapshot;
  try { snapshot = JSON.parse(bytes.toString('utf8')); } catch { fail(); }
  const events = snapshot?.rows?.EVENTO_RECURRENTE;
  if (snapshot.database !== database || snapshot.port !== 20378 || !Array.isArray(events)
    || snapshot.tables?.EVENTO_RECURRENTE?.count !== events.length
    || snapshot.tables.EVENTO_RECURRENTE.hash !== digest(JSON.stringify(events))) fail();
  const ids = new Set();
  for (const event of events) {
    if (!Number.isSafeInteger(event.id_evento) || event.id_evento <= 0
      || ids.has(event.id_evento)) fail();
    ids.add(event.id_evento);
  }
  return { events, hash: expectedHash };
}
function assertBinding(original, current, revision) {
  for (const key of ['id_evento','ambiente','svix_id','hash_body','tipo_evento',
    'id_operacion_externa','recibido_en','sandbox_id','live_mode','id_checkout']) {
    if (original[key] !== current[key]) fail();
  }
  if (original.estado !== 'REVISION' || original.estado !== revision.estado_anterior
    || original.error_codigo !== revision.error_anterior || original.intentos !== revision.intentos_anteriores
    || original.id_evento !== revision.id_evento || original.ambiente !== revision.ambiente
    || current.intentos <= original.intentos || !revision.finalizado_en) fail();
}
async function repairReviewPrecision(connection, { evidence, database, apply = false, operator = 'local-test-operator' }) {
  if (!/^[A-Za-z0-9_.-]{1,64}$/.test(operator)) fail();
  let inTransaction = false;
  try {
    await connection.query(apply ? 'START TRANSACTION' : 'START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
    inTransaction = true;
    const [[identity]] = await connection.query('SELECT DATABASE() db');
    if (identity.db !== database) fail();
    const plans = [], unchanged = [];
    for (const original of evidence.events.filter(e => e.estado === 'REVISION').sort((a,b) => a.id_evento-b.id_evento)) {
      const [events] = await connection.query({ sql: 'SELECT * FROM EVENTO_RECURRENTE WHERE id_evento=?' + (apply ? ' FOR UPDATE' : ''), dateStrings: true }, [original.id_evento]);
      const [revisions] = await connection.query({ sql: 'SELECT * FROM REVISION_EVENTO_RECURRENTE WHERE id_evento=? AND ambiente=? AND intentos_anteriores=?' + (apply ? ' FOR UPDATE' : ''), dateStrings: true }, [original.id_evento,original.ambiente,original.intentos]);
      if (!revisions.length) continue;
      if (revisions.length !== 1 || !events[0]) fail();
      const revision = revisions[0]; assertBinding(original, events[0], revision);
      if (original.procesado_en === null) {
        if (revision.procesado_anterior !== null) fail();
        unchanged.push(revision.id_revision); continue;
      }
      if (!exactTimestamp(original.procesado_en)) fail();
      const [repairs] = await connection.query({sql:'SELECT * FROM REPARACION_REVISION_RECURRENTE WHERE id_revision=?',dateStrings:true},[revision.id_revision]);
      if (repairs.length) {
        const previous = repairs[0];
        if (previous.id_evento !== original.id_evento || previous.ambiente !== original.ambiente
          || previous.hash_snapshot !== evidence.hash || previous.hash_evento_original !== digest(JSON.stringify(original))
          || previous.valor_restaurado !== original.procesado_en || previous.valor_anterior !== truncatedMilliseconds(original.procesado_en)
          || revision.procesado_anterior !== original.procesado_en) fail();
        unchanged.push(revision.id_revision); continue;
      }
      if (revision.procesado_anterior === original.procesado_en) { unchanged.push(revision.id_revision); continue; }
      const truncated = truncatedMilliseconds(original.procesado_en);
      if (truncated === original.procesado_en || revision.procesado_anterior !== truncated) fail();
      plans.push({ revisionId: revision.id_revision, eventId: original.id_evento, environment: original.ambiente,
        before: truncated, after: original.procesado_en, originalHash: digest(JSON.stringify(original)) });
    }
    // Validate the entire plan before changing even one historical row.
    if (apply) for (const plan of plans) {
      const [updated] = await connection.execute(`UPDATE REVISION_EVENTO_RECURRENTE SET procesado_anterior=CAST(? AS DATETIME(6))
        WHERE id_revision=? AND procesado_anterior=CAST(? AS DATETIME(6))`, [plan.after,plan.revisionId,plan.before]);
      if (updated.affectedRows !== 1) fail();
      await connection.execute(`INSERT INTO REPARACION_REVISION_RECURRENTE
        (id_revision,id_evento,ambiente,valor_anterior,valor_restaurado,hash_snapshot,hash_evento_original,operador)
        VALUES(?,?,?,?,?,?,?,?)`, [plan.revisionId,plan.eventId,plan.environment,plan.before,plan.after,evidence.hash,plan.originalHash,operator]);
    }
    if (apply) await connection.commit(); else await connection.rollback();
    inTransaction = false;
    return { mode: apply ? 'repair' : 'read-only', planned: plans.length, repaired: apply ? plans.length : 0,
      unchanged, revisions: plans.map(({originalHash,...safe}) => safe), financialRowsModified: 0 };
  } catch (error) { if (inTransaction) await connection.rollback(); throw error; }
}
module.exports = { readEvidence, repairReviewPrecision, assertBinding, exactTimestamp, truncatedMilliseconds };
