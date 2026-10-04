const {test,describe,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID,createHash}=require('node:crypto');
const {configureTestEnvironment,connect}=require('./support/isolatedMysql');
if(process.env.RUN_PHASE0_MYSQL_TESTS!=='1')test('Precision requires disposable MySQL runner',{skip:true},()=>{});
else{
 const isolation=require('./support/suiteIsolation');isolation.assertOwnedSuiteDatabase();configureTestEnvironment();
 const db=require('../../src/database/mysql');
 const {archiveReview}=require('../../src/services/recurrenteReviewAudit');
 const {readEvidence,repairReviewPrecision,truncatedMilliseconds}=require('../../src/services/recurrenteReviewPrecisionRepair');
 const {previewReview}=require('../../src/services/recurrenteRecoveryPreview');
 const {createWebhookService}=require('../../src/services/recurrenteWebhookService');
 const {inspectEvent,verifyWebhook}=require('../../src/services/recurrenteWebhookPayload');
 const {TEST_SANDBOX,configuration,signed}=require('./support/recurrenteWebhookFixtures');
 const {failedThenSucceeded}=require('./support/recurrenteRecoveryFixtures');
 let c,protectedBefore;const q=async(sql,args=[])=>(await c.query(sql,args))[0];
 const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
 const financialTables=['CUOTA','PAGO','PAGO_ORIGEN','RECARGO_APLICADO','CHECKOUT_RECURRENTE','TRANSACCION_RECURRENTE','REEMBOLSO_RECURRENTE'];
 const financialSnapshot=()=>Promise.all(financialTables.map(t=>q('SELECT * FROM `'+t+'` ORDER BY 1')));
 function evidence(events){const data={database:process.env.PHASE0_TEST_DATABASE,port:20378,rows:{EVENTO_RECURRENTE:events},tables:{EVENTO_RECURRENTE:{count:events.length,hash:digest(JSON.stringify(events))}}};const bytes=Buffer.from(JSON.stringify(data));return readEvidence(bytes,digest(bytes),data.database);}
 async function fixture(timestamp,{truncate=false}={}){
  const eventId=(await q(`INSERT INTO EVENTO_RECURRENTE(svix_id,ambiente,tipo_evento,hash_body,estado,intentos,
   error_codigo,procesado_en,sandbox_id,live_mode) VALUES(?,'sandbox','intent.succeeded',?,'REVISION',1,'WEBHOOK_TRANSACTION_MISMATCH',?,?,0)`,
   ['msg_TEST_'+randomUUID(),digest('fixture'),timestamp,TEST_SANDBOX])).insertId;
  const original=(await q('SELECT * FROM EVENTO_RECURRENTE WHERE id_evento=?',[eventId]))[0];
  // Use the production pool's default Date parser, not the dateStrings test connection.
  const p=await db.pool.getConnection();let revisionId;try{revisionId=await archiveReview(p,eventId,'fixture-test');}finally{p.release();}
  await q("UPDATE REVISION_EVENTO_RECURRENTE SET finalizado_en=NOW(6),estado_resultante='PROCESADO' WHERE id_revision=?",[revisionId]);
  await q("UPDATE EVENTO_RECURRENTE SET estado='PROCESADO',intentos=2,procesado_en=NOW(6),error_codigo=NULL WHERE id_evento=?",[eventId]);
  if(truncate&&timestamp)await q('UPDATE REVISION_EVENTO_RECURRENTE SET procesado_anterior=? WHERE id_revision=?',[truncatedMilliseconds(timestamp),revisionId]);
  return {eventId,revisionId,original,evidence:evidence([original])};
 }
 const run=(f,apply=false,connection=c)=>repairReviewPrecision(connection,{evidence:f.evidence,database:process.env.PHASE0_TEST_DATABASE,apply});
 describe('Exact internal SQL audit timestamps and controlled repair',{concurrency:false},()=>{
  before(async()=>{c=await connect();protectedBefore=await isolation.protectedSnapshot(c);});
  after(async()=>{assert.deepEqual(await isolation.protectedSnapshot(c),protectedBefore);await c.end();await db.pool.end();});
  test('root cause: mysql2 default Date parser loses sub-millisecond digits',async()=>{
   const [[row]]=await db.pool.execute("SELECT CAST('2026-10-04 11:50:01.277859' AS DATETIME(6)) value");
   assert(row.value instanceof Date);assert.equal(row.value.getMilliseconds(),277);
   const [[roundtrip]]=await c.execute("SELECT DATE_FORMAT(CAST(? AS DATETIME(6)),'%f') micros",[row.value]);assert.equal(roundtrip.micros,'277000');
  });
  for(const stamp of ['2026-10-04 11:50:01.277859','2026-10-04 11:50:01.000001','2026-10-04 11:50:01.999999','2024-02-29 23:59:59.123456','2026-10-04 11:50:01.123000','2026-10-04 11:50:01.000000',null])test('SQL -> SQL preserves exactly '+stamp,async()=>{
   const f=await fixture(stamp);assert.equal((await q('SELECT procesado_anterior FROM REVISION_EVENTO_RECURRENTE WHERE id_revision=?',[f.revisionId]))[0].procesado_anterior,stamp);
   const before=await financialSnapshot();const result=await run(f,true);assert.equal(result.repaired,0);assert.deepEqual(await financialSnapshot(),before);
  });
  test('multiple reviews of same event preserve their own microsecond timestamps',async()=>{
   const f=await fixture('2026-10-04 11:50:01.277859');
   await q("UPDATE EVENTO_RECURRENTE SET estado='REVISION',procesado_en='2026-10-04 11:50:01.999999' WHERE id_evento=?",[f.eventId]);
   await archiveReview(c,f.eventId,'fixture-test');
   assert.deepEqual((await q('SELECT procesado_anterior FROM REVISION_EVENTO_RECURRENTE WHERE id_evento=? ORDER BY id_revision',[f.eventId])).map(r=>r.procesado_anterior),['2026-10-04 11:50:01.277859','2026-10-04 11:50:01.999999']);
  });
  for(const stamp of ['2026-10-04 11:50:01.277859','2026-10-04 11:50:01.000001','2026-10-04 11:50:01.999999'])test('repair exact original '+stamp+'; dry-run and reapplication',async()=>{
   const f=await fixture(stamp,{truncate:true}),financial=await financialSnapshot();
   assert.equal((await run(f)).planned,1);assert.equal((await q('SELECT COUNT(*) n FROM REPARACION_REVISION_RECURRENTE WHERE id_revision=?',[f.revisionId]))[0].n,0);
   assert.equal((await q('SELECT procesado_anterior FROM REVISION_EVENTO_RECURRENTE WHERE id_revision=?',[f.revisionId]))[0].procesado_anterior,truncatedMilliseconds(stamp));
   assert.equal((await run(f,true)).repaired,1);assert.equal((await run(f,true)).repaired,0);
   assert.equal((await q('SELECT procesado_anterior FROM REVISION_EVENTO_RECURRENTE WHERE id_revision=?',[f.revisionId]))[0].procesado_anterior,stamp);
   const audit=await q('SELECT * FROM REPARACION_REVISION_RECURRENTE WHERE id_revision=?',[f.revisionId]);assert.equal(audit.length,1);assert.equal(audit[0].valor_restaurado,stamp);assert.equal(audit[0].valor_anterior,truncatedMilliseconds(stamp));assert.deepEqual(await financialSnapshot(),financial);
  });
  test('rejects wrong milliseconds, wrong binding and missing source without changing rows',async()=>{
   const f=await fixture('2026-10-04 11:50:01.277859',{truncate:true});
   await q("UPDATE REVISION_EVENTO_RECURRENTE SET procesado_anterior='2026-10-04 11:50:01.278000' WHERE id_revision=?",[f.revisionId]);await assert.rejects(run(f,true));
   await q("UPDATE REVISION_EVENTO_RECURRENTE SET procesado_anterior='2026-10-04 11:50:01.277000' WHERE id_revision=?",[f.revisionId]);
   const foreign={...f,evidence:evidence([{...f.original,svix_id:'msg_TEST_other'}])};await assert.rejects(run(foreign,true));assert.equal((await q('SELECT COUNT(*) n FROM REPARACION_REVISION_RECURRENTE WHERE id_revision=?',[f.revisionId]))[0].n,0);
  });
  test('repair audit failure rolls back timestamp and all repair evidence',async()=>{
   const f=await fixture('2026-10-04 11:50:01.277859',{truncate:true}),financial=await financialSnapshot();
   const p=await db.pool.getConnection(),execute=p.execute.bind(p);p.execute=(sql,args)=>sql.startsWith('INSERT INTO REPARACION_REVISION_RECURRENTE')?execute('SELECT nonexistent_precision_column FROM CUOTA'):execute(sql,args);
   try{await assert.rejects(run(f,true,p));}finally{p.execute=execute;p.release();}
   assert.equal((await q('SELECT procesado_anterior FROM REVISION_EVENTO_RECURRENTE WHERE id_revision=?',[f.revisionId]))[0].procesado_anterior,'2026-10-04 11:50:01.277000');assert.deepEqual(await financialSnapshot(),financial);
   assert.equal((await q('SELECT COUNT(*) n FROM REPARACION_REVISION_RECURRENTE WHERE id_revision=?',[f.revisionId]))[0].n,0);
  });
  test('007 reapplies safely and preserves prior tables and repaired history',async()=>{
   const migration=require('../../src/database/recurrenteMigration');const before=await q('SELECT * FROM REPARACION_REVISION_RECURRENTE ORDER BY 1');const financial=await financialSnapshot();
   await migration.applyRecurrenteReviewPrecisionMigration(c);await migration.applyRecurrenteReviewPrecisionMigration(c);assert.deepEqual(await q('SELECT * FROM REPARACION_REVISION_RECURRENTE ORDER BY 1'),before);assert.deepEqual(await financialSnapshot(),financial);
  });
  test('confirmed payment duplicate preview is read-only; duplicate recovery archives exact timestamp',async()=>{
   const id=(await q("INSERT INTO CUOTA(id_servicio,id_casa,monto,fecha_limite) VALUES(1,1,5,'2026-11-10')")).insertId;
   const local={id_cuota:id,id_usuario:3,id_residente:1,id_casa:1,id_externo:'ch_TEST_'+randomUUID().replaceAll('-',''),referencia_local:randomUUID(),idempotency_key:randomUUID(),monto_centavos:500,capital_centavos:500,recargo_centavos:0,moneda:'GTQ',ambiente:'sandbox',sandbox_id:TEST_SANDBOX,estado:'PENDIENTE',estado_proveedor:'unpaid'};
   local.id_checkout=(await q('INSERT INTO CHECKOUT_RECURRENTE SET ?',local)).insertId;
   const data=failedThenSucceeded(local),engine=createWebhookService();
   const input=payload=>{const f=signed(payload),v=verifyWebhook(f.raw,f.headers,configuration());return {...v,event:inspectEvent(v.payload,TEST_SANDBOX),sandboxId:TEST_SANDBOX};};
   await engine.receive(input(data.failed));await engine.receive(input(data.success.paymentIntent));
   const raw=signed(data.success.intent),event=inspectEvent(data.success.intent,TEST_SANDBOX),stamp='2026-10-04 11:50:01.999999';
   const eventId=(await q(`INSERT INTO EVENTO_RECURRENTE(svix_id,ambiente,tipo_evento,id_operacion_externa,hash_body,estado,intentos,error_codigo,procesado_en,sandbox_id,live_mode,id_checkout)
    VALUES(?,'sandbox',?,?,?,'REVISION',1,'WEBHOOK_TRANSACTION_MISMATCH',?,?,0,?)`,[raw.svixId,event.eventType,event.sourceId,digest(raw.raw),stamp,TEST_SANDBOX,local.id_checkout])).insertId;
   const receipt=(await q('SELECT * FROM EVENTO_RECURRENTE WHERE id_evento=?',[eventId]))[0];const before=await financialSnapshot();
   const preview=await previewReview(c,{receipt,event,sandboxId:TEST_SANDBOX});assert.equal(preview.result,'duplicate');assert.equal(preview.balance,'0.00');assert(preview.paymentId);assert.deepEqual(await financialSnapshot(),before);
   for(const modified of [{...event,paymentId:'pa_TEST_foreign'},{...event,amount:501},{...event,externalId:'in_TEST_other'},{...event,time:{...event.time,original:'2026-10-02T11:00:00-06:00'}}])assert.equal((await previewReview(c,{receipt,event:modified,sandboxId:TEST_SANDBOX})).result,'review');
   assert.equal(await engine.reprocessReview({eventId,originalBody:raw.raw,sandboxId:TEST_SANDBOX}),'duplicate');assert.deepEqual(await financialSnapshot(),before);
   assert.equal((await q('SELECT procesado_anterior FROM REVISION_EVENTO_RECURRENTE WHERE id_evento=?',[eventId]))[0].procesado_anterior,stamp);
  });
  test('backup/restore preserves exact originals, review dates and repair log including NULL',async()=>{
   const f=await fixture('2026-10-04 11:50:01.277859',{truncate:true});await run(f,true);
   const content=await require('../../src/services/automaticBackupsService').generateSql();
   assert(content.includes('2026-10-04 11:50:01.277859'));const restore=require('../../src/services/restoresService');const validation=restore.validateBackupPayload({filename:'precision.sql',content});assert(validation.tables.includes('REPARACION_REVISION_RECURRENTE'));
   const target=await connect(await isolation.createOwnedRestoreDatabase(c));try{
    await target.query('SET FOREIGN_KEY_CHECKS=0');const tables=await q('SELECT TABLE_NAME name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()');
    for(const {name}of tables){const [ddl]=await q('SHOW CREATE TABLE `'+name+'`');await target.query(ddl['Create Table'].replace('CREATE TABLE','CREATE TABLE IF NOT EXISTS'));}
    for(const sql of validation.statements)await target.query(sql);await target.query('SET FOREIGN_KEY_CHECKS=1');
    for(const t of ['EVENTO_RECURRENTE','REVISION_EVENTO_RECURRENTE','REPARACION_REVISION_RECURRENTE'])assert.deepEqual((await target.query('SELECT * FROM `'+t+'` ORDER BY 1'))[0],await q('SELECT * FROM `'+t+'` ORDER BY 1'));
    await restore.verifyRestoredReferences(target,require('../../src/database/backupTables').BACKUP_TABLES);
   }finally{await target.end();}
  });
 });
}
