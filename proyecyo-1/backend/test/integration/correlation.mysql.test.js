const {test,describe,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID,createHash}=require('node:crypto');
const {configureTestEnvironment,connect}=require('./support/isolatedMysql');
if(process.env.RUN_PHASE0_MYSQL_TESTS!=='1')test('Correlación requiere runner MySQL temporal',{skip:true},()=>{});
else {
  const isolation=require('./support/suiteIsolation');isolation.assertOwnedSuiteDatabase();configureTestEnvironment();
  const db=require('../../src/database/mysql');
  const {createWebhookService}=require('../../src/services/recurrenteWebhookService');
  const {verifyWebhook,inspectEvent}=require('../../src/services/recurrenteWebhookPayload');
  const {configuration,signed,TEST_SANDBOX}=require('./support/recurrenteWebhookFixtures');
  const {failedThenSucceeded}=require('./support/recurrenteRecoveryFixtures');
  const {QUOTA_BALANCES_SQL}=require('../../src/services/financialBalance');
  let c,protectedBefore;const q=async(sql,args=[])=>(await c.query(sql,args))[0];
  const engine=createWebhookService();
  function input(payload,options){const f=signed(payload,options),v=verifyWebhook(f.raw,f.headers,configuration());return {...v,event:inspectEvent(v.payload,TEST_SANDBOX),sandboxId:TEST_SANDBOX};}
  const deliver=(payload,options,target=engine)=>target.receive(input(payload,options));
  const balances=async id=>(await q(`SELECT * FROM (${QUOTA_BALANCES_SQL}) b WHERE id_cuota=?`,[id]))[0];
  const rows=(table,id)=>q(`SELECT * FROM ${table} WHERE id_cuota=? ORDER BY 1`,[id]);
  async function fixture({principal='5.00',surcharge='0.00',amount=500}={}){
    const id=(await q("INSERT INTO CUOTA(id_servicio,id_casa,monto,fecha_limite) VALUES(1,1,?,'2026-11-10')",[principal])).insertId;
    if(Number(surcharge))await q("INSERT INTO RECARGO_APLICADO(id_cuota,id_casa,tipo_regla,monto_original,monto_recargo,fecha_aplicacion) VALUES(?,1,'FIJO',?,?,'2026-10-01')",[id,principal,surcharge]);
    const local={id_cuota:id,id_usuario:3,id_residente:1,id_casa:1,id_externo:`ch_TEST_${randomUUID().replaceAll('-','')}`,
      referencia_local:randomUUID(),idempotency_key:randomUUID(),monto_centavos:amount,capital_centavos:Math.max(0,amount-Number(surcharge)*100),
      recargo_centavos:Math.min(amount,Number(surcharge)*100),moneda:'GTQ',ambiente:'sandbox',sandbox_id:TEST_SANDBOX,
      estado:'PENDIENTE',estado_proveedor:'unpaid',checkout_url:'https://app.recurrente.com/checkout-session/ch_TEST_fixture'};
    local.checkout_url=`https://app.recurrente.com/checkout-session/${local.id_externo}`;
    local.id_checkout=(await q('INSERT INTO CHECKOUT_RECURRENTE SET ?',local)).insertId;
    return {id,local,...failedThenSucceeded(local)};
  }
  async function failed(f){assert.equal(await deliver(f.legacy),'processed');assert.equal(await deliver(f.failed),'duplicate');}
  async function paidOnce(f){
    const p=await rows('PAGO',f.id),o=await rows('PAGO_ORIGEN',f.id),tr=await rows('TRANSACCION_RECURRENTE',f.id);
    assert.equal(p.length,1);assert.equal(o.length,1);assert.equal(tr.length,1);
    assert.equal(p[0].monto_pagado,(f.local.monto_centavos/100).toFixed(2));assert.equal(p[0].fecha_pago,'2026-10-02');
    assert.equal(o[0].origen,'RECURRENTE');assert.equal(tr[0].estado,'CONFIRMADA');assert.equal(tr[0].id_pago,p[0].id_pago);
    assert.equal(tr[0].id_externo,f.success.intent.id);assert.equal(tr[0].id_pago_externo,f.failed.payment.id);
    return tr[0];
  }
  async function storedReview(f,payload=f.success.paymentIntent){
    const data=signed(payload),event=inspectEvent(payload,TEST_SANDBOX);
    const eventId=(await q(`INSERT INTO EVENTO_RECURRENTE(svix_id,ambiente,tipo_evento,id_operacion_externa,hash_body,
      estado,intentos,error_codigo,procesado_en,sandbox_id,live_mode,id_checkout)
      VALUES(?,'sandbox',?,?,?,'REVISION',1,'WEBHOOK_TRANSACTION_MISMATCH',NOW(6),?,0,?)`,
      [data.svixId,event.eventType,event.sourceId,createHash('sha256').update(data.raw).digest('hex'),TEST_SANDBOX,f.local.id_checkout])).insertId;
    return {eventId,originalBody:data.raw,sandboxId:TEST_SANDBOX};
  }
  function failingPool(pattern){let triggered=false;return {getConnection:async()=>{const connection=await db.pool.getConnection(),execute=connection.execute.bind(connection),release=connection.release.bind(connection);
    connection.execute=(sql,args)=>{if(!triggered&&pattern.test(sql)){triggered=true;return execute('SELECT nonexistent_recovery_column FROM CUOTA');}return execute(sql,args);};
    connection.release=()=>{connection.execute=execute;connection.release=release;release();};return connection;}};}
  describe('Contrato real: intent A fallido -> intent B exitoso, un payment y checkout',{concurrency:false},()=>{
    before(async()=>{c=await connect();protectedBefore=await isolation.protectedSnapshot(c);});
    after(async()=>{assert.deepEqual(await isolation.protectedSnapshot(c),protectedBefore);await c.end();await db.pool.end();});
    test('006 aditiva reaplicable conserva datos, PK/FK/UNIQUE/CHECK y no hace backfill',async()=>{
      const migrations=require('../../src/database/recurrenteMigration');
      const tables=['PAGO','PAGO_ORIGEN','TRANSACCION_RECURRENTE','EVENTO_RECURRENTE','INTENTO_RECURRENTE','REVISION_EVENTO_RECURRENTE'];
      const snapshots=await Promise.all(tables.map(t=>q(`SELECT * FROM ${t} ORDER BY 1`)));
      await migrations.applyRecurrenteIntentHistoryMigration(c);await migrations.applyRecurrenteIntentHistoryMigration(c);
      for(let i=0;i<tables.length;i++)assert.deepEqual(await q(`SELECT * FROM ${tables[i]} ORDER BY 1`),snapshots[i]);
      assert.doesNotMatch(require('node:fs').readFileSync(migrations.INTENT_HISTORY_MIGRATION_PATH,'utf8'),/\bDROP\s+(TABLE|COLUMN|DATABASE)|\bDELETE\s+FROM|\bTRUNCATE/i);
      for(const table of tables.slice(-2)){const keys=await q('SELECT CONSTRAINT_TYPE type FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME=?',[table]);for(const type of ['PRIMARY KEY','FOREIGN KEY','UNIQUE','CHECK'])assert(keys.some(k=>k.type===type));}
    });
    test('fixture real sanitizado: fallo conservado, dos success, un PAGO y Q5 -> Q0',async()=>{
      const f=await fixture();await failed(f);assert.equal((await balances(f.id)).saldo_pendiente,'5.00');
      const before=(await rows('TRANSACCION_RECURRENTE',f.id))[0];
      assert.equal(await deliver(f.success.paymentIntent),'processed');assert.equal(await deliver(f.success.intent),'duplicate');
      const tr=await paidOnce(f);assert.equal(tr.id_transaccion,before.id_transaccion);assert.equal((await balances(f.id)).saldo_pendiente,'0.00');
      const history=await q('SELECT * FROM INTENTO_RECURRENTE WHERE id_transaccion=? ORDER BY id_intento',[tr.id_transaccion]);
      assert.deepEqual(history.map(r=>[r.id_externo,r.estado]),[[f.failed.id,'FALLIDA'],[f.success.intent.id,'CONFIRMADA']]);
      assert.equal(history[0].fecha_proveedor_original,f.failed.created_at);assert.equal(history[1].fecha_proveedor_original,f.success.intent.created_at);
    });
    test('fallo genuino sin éxito mantiene FALLIDA, Q5 y cero PAGO',async()=>{const f=await fixture();await failed(f);assert.equal((await rows('TRANSACCION_RECURRENTE',f.id))[0].estado,'FALLIDA');assert.equal((await rows('PAGO',f.id)).length,0);assert.equal((await balances(f.id)).saldo_pendiente,'5.00');});
    test('dos svix success concurrentes convergen en una aplicación',async()=>{const f=await fixture();await failed(f);assert.deepEqual((await Promise.all([deliver(f.success.intent),deliver(f.success.paymentIntent)])).sort(),['duplicate','processed']);await paidOnce(f);});
    test('success -> success duplicado no vuelve a aplicar',async()=>{const f=await fixture();assert.equal(await deliver(f.success.intent),'processed');const p=await rows('PAGO',f.id);assert.equal(await deliver(f.success.paymentIntent),'duplicate');assert.equal(await deliver(f.success.intent),'duplicate');assert.deepEqual(await rows('PAGO',f.id),p);});
    test('success -> failed tardío conserva éxito y no altera saldo',async()=>{const f=await fixture();await failed(f);await deliver(f.success.intent);const tr=await rows('TRANSACCION_RECURRENTE',f.id);assert.equal(await deliver(f.failed),'duplicate');assert.deepEqual(await rows('TRANSACCION_RECURRENTE',f.id),tr);assert.equal((await balances(f.id)).saldo_pendiente,'0.00');});
    test('fallo tardío desconocido no degrada un éxito',async()=>{const f=await fixture();await deliver(f.success.intent);assert.equal(await deliver(f.failed),'review');await paidOnce(f);});
    test('recuperar REVISION conserva svix/hash/recepción y archiva revisión original',async()=>{
      const f=await fixture();await failed(f);const recovery=await storedReview(f),before=(await q('SELECT * FROM EVENTO_RECURRENTE WHERE id_evento=?',[recovery.eventId]))[0];
      // Simulate a pre-006 historical attempt: archival must happen within recovery.
      await q('DELETE FROM INTENTO_RECURRENTE WHERE id_transaccion IN (SELECT id_transaccion FROM TRANSACCION_RECURRENTE WHERE id_cuota=?)',[f.id]);
      assert.equal(await engine.reprocessReview(recovery),'processed');assert.equal(await engine.reprocessReview(recovery),'duplicate');
      const afterRow=(await q('SELECT * FROM EVENTO_RECURRENTE WHERE id_evento=?',[recovery.eventId]))[0];
      for(const field of ['id_evento','svix_id','hash_body','recibido_en','id_operacion_externa'])assert.equal(afterRow[field],before[field]);
      const audit=await q('SELECT * FROM REVISION_EVENTO_RECURRENTE WHERE id_evento=?',[recovery.eventId]);assert.equal(audit.length,1);assert.equal(audit[0].error_anterior,'WEBHOOK_TRANSACTION_MISMATCH');assert.equal(audit[0].estado_resultante,'PROCESADO');assert.equal(afterRow.intentos,2);
      const tr=await paidOnce(f);assert.equal((await q('SELECT COUNT(*) n FROM INTENTO_RECURRENTE WHERE id_transaccion=?',[tr.id_transaccion]))[0].n,2);
    });
    test('dos requests de recuperación del mismo evento son idempotentes',async()=>{const f=await fixture();await failed(f);const r=await storedReview(f);assert.deepEqual((await Promise.all([engine.reprocessReview(r),engine.reprocessReview(r)])).sort(),['duplicate','processed']);await paidOnce(f);assert.equal((await q('SELECT COUNT(*) n FROM REVISION_EVENTO_RECURRENTE WHERE id_evento=?',[r.eventId]))[0].n,1);});
    test('dos eventos REVISION distintos se recuperan sin doble PAGO',async()=>{const f=await fixture();await failed(f);const a=await storedReview(f),b=await storedReview(f,f.success.intent);assert.deepEqual((await Promise.all([engine.reprocessReview(a),engine.reprocessReview(b)])).sort(),['duplicate','processed']);await paidOnce(f);});
    test('webhook success mientras se recupera REVISION crea un solo abono',async()=>{const f=await fixture();await failed(f);const r=await storedReview(f);assert.deepEqual((await Promise.all([engine.reprocessReview(r),deliver(f.success.intent)])).sort(),['duplicate','processed']);await paidOnce(f);});
    test('rollback durante recuperación conserva REVISION y fallo histórico, cero abono',async()=>{const f=await fixture();await failed(f);const r=await storedReview(f),before=await rows('TRANSACCION_RECURRENTE',f.id);await assert.rejects(createWebhookService({pool:failingPool(/INSERT INTO PAGO_ORIGEN/)}).reprocessReview(r));assert.deepEqual(await rows('TRANSACCION_RECURRENTE',f.id),before);assert.equal((await rows('PAGO',f.id)).length,0);assert.equal((await q('SELECT estado FROM EVENTO_RECURRENTE WHERE id_evento=?',[r.eventId]))[0].estado,'REVISION');assert.equal(await engine.reprocessReview(r),'processed');await paidOnce(f);});
    test('PAGO previo y saldo Q0 bloquean otra aplicación',async()=>{const f=await fixture();await failed(f);const p=(await q("INSERT INTO PAGO(id_cuota,monto_pagado,fecha_pago) VALUES(?,5,'2026-10-01')",[f.id])).insertId;await q("INSERT INTO PAGO_ORIGEN(id_pago,id_cuota,origen,ambiente) VALUES(?,?,'HISTORICO','historical')",[p,f.id]);assert.equal(await deliver(f.success.intent),'review');assert.equal((await rows('PAGO',f.id)).length,1);assert.equal((await balances(f.id)).saldo_pendiente,'0.00');});
    const invalid=[
      ['payment coincide pero checkout distinto',(f,p,g)=>{p.checkout.id=g.local.id_externo;p.checkout.metadata.nexus_checkout_reference=g.local.referencia_local;}],
      ['checkout coincide pero payment distinto',(f,p)=>{p.payment.id='pa_TEST_foreign';p.checkout.payment.id=p.payment.id;}],
      ['monto distinto',(f,p)=>{p.amount_in_cents=501;p.checkout.total_in_cents=501;}],
      ['moneda distinta',(f,p)=>{p.currency='USD';p.checkout.currency='USD';}],
      ['referencia local distinta',(f,p)=>{p.checkout.metadata.nexus_checkout_reference=randomUUID();}],
      ['Sandbox distinto',(f,p)=>{p.sandbox_id='sbx_TEST_other';}],
      ['live_mode incorrecto',(f,p)=>{p.live_mode=true;p.checkout.live_mode=true;}],
      ['sin estado paid',(f,p)=>{p.checkout.status='unpaid';}],
      ['sin latest_intent inequívoco',(f,p)=>{delete p.checkout.latest_intent;}],
      ['éxito anterior al fallo',(f,p)=>{p.created_at='2026-10-02T11:00:00-06:00';}],
    ];
    for(const [name,change]of invalid)test(name+' no crea PAGO',async()=>{const f=await fixture(),g=await fixture();await failed(f);const p=structuredClone(f.success.intent);change(f,p,g);assert(['review','ignored'].includes(await deliver(p)));assert.equal((await rows('PAGO',f.id)).length,0);assert.equal((await rows('PAGO',g.id)).length,0);assert.equal((await balances(f.id)).saldo_pendiente,'5.00');});
    test('asociación residente/cuota incompatible permanece en revisión',async()=>{const f=await fixture();await failed(f);await q('UPDATE CHECKOUT_RECURRENTE SET id_residente=NULL WHERE id_checkout=?',[f.local.id_checkout]);assert.equal(await deliver(f.success.intent),'review');assert.equal((await rows('PAGO',f.id)).length,0);});
    test('fallo sin payment conocido no se correlaciona solo por checkout',async()=>{const f=await fixture();delete f.failed.payment;delete f.failed.checkout.payment;assert.equal(await deliver(f.failed),'processed');assert.equal(await deliver(f.success.intent),'review');assert.equal((await rows('PAGO',f.id)).length,0);});
    test('webhook del mismo svix-id durante recuperación no vuelve a aplicar',async()=>{const f=await fixture();await failed(f);const r=await storedReview(f),[inbox]=await q('SELECT svix_id FROM EVENTO_RECURRENTE WHERE id_evento=?',[r.eventId]);const results=await Promise.all([engine.reprocessReview(r),deliver(f.success.paymentIntent,{svixId:inbox.svix_id})]);assert.equal(results.filter(s=>s==='processed').length,1);assert(results.every(s=>['processed','duplicate','review'].includes(s)));await paidOnce(f);});
    test('recargos primero, capital después y sin saldo negativo tras recuperar',async()=>{const f=await fixture({principal:'100.00',surcharge:'15.00',amount:5000});await failed(f);await deliver(f.success.intent);const tr=await paidOnce(f),b=await balances(f.id);assert.equal(tr.recargo_aplicado_centavos,1500);assert.equal(tr.capital_aplicado_centavos,3500);assert.equal(b.capital_pendiente,'65.00');assert.equal(b.recargo_pendiente,'0.00');assert.equal(b.saldo_pendiente,'65.00');});
    test('body alterado, Sandbox ajeno y evento inexistente no recuperan',async()=>{const f=await fixture();await failed(f);const r=await storedReview(f);for(const bad of [{...r,originalBody:Buffer.concat([r.originalBody,Buffer.from(' ')])},{...r,sandboxId:'sbx_TEST_other'},{...r,eventId:999999999}])await assert.rejects(engine.reprocessReview(bad));assert.equal((await rows('PAGO',f.id)).length,0);});
    test('revisión posterior oculta FALLIDO y bloquea crear/retry antes de cualquier API',async()=>{const f=await fixture();await failed(f);await storedReview(f);const calls=[];const service=require('../../src/services/recurrenteCheckoutService').createCheckoutService({client:{sandboxId:()=>TEST_SANDBOX,createCheckout:()=>calls.push('create'),verifyCheckout:()=>calls.push('get')}});const status=await service.residentCheckoutStatus(3,f.local.referencia_local);assert.equal(status.estado,'INCIERTO');assert.equal(status.accion,'NINGUNA');assert.match(status.mensaje,/No intentes pagar nuevamente/);await assert.rejects(service.retryResidentCheckout(3,f.local.referencia_local),e=>e.code==='CHECKOUT_UNCERTAIN');await assert.rejects(service.startResidentCheckout(3,f.id),e=>e.code==='CHECKOUT_UNCERTAIN');assert.deepEqual(calls,[]);});
    test('éxito firmado con monto/moneda inválidos mantiene bloqueo de revisión',async()=>{const f=await fixture();await failed(f);const payload=structuredClone(f.success.intent);payload.currency='USD';payload.checkout.currency='USD';assert.equal(await deliver(payload),'review');const service=require('../../src/services/recurrenteCheckoutService').createCheckoutService({client:{sandboxId:()=>TEST_SANDBOX}});assert.equal((await service.residentCheckoutStatus(3,f.local.referencia_local)).estado,'INCIERTO');await assert.rejects(service.retryResidentCheckout(3,f.local.referencia_local),e=>e.code==='CHECKOUT_UNCERTAIN');assert.equal((await rows('PAGO',f.id)).length,0);});
    test('HU16 comprobante y HU18 elegibilidad TOTAL funcionan después de recuperar',async()=>{const f=await fixture();await failed(f);await engine.reprocessReview(await storedReview(f));const tr=await paidOnce(f);const receipt=await require('../../src/services/paymentReceiptService').getPaymentReceipt(3,'residente',tr.id_pago);assert.equal(receipt.id_pago,tr.id_pago);const refund=require('../../src/services/recurrenteRefundService').createRefundService({client:require('./support/recurrenteRefundFixtures').mockClient()});const eligibility=await refund.eligibility({id:1,role:'admin'},tr.id_transaccion);assert.equal(eligibility.elegible,true);assert.equal(eligibility.disponible_centavos,500);assert.equal((await q('SELECT COUNT(*) n FROM REEMBOLSO_RECURRENTE WHERE id_transaccion=?',[tr.id_transaccion]))[0].n,0);});
    test('HU17 concilia intent exitoso y encuentra referencia fallida histórica sin efectos financieros',async()=>{
      const f=await fixture();await failed(f);await engine.reprocessReview(await storedReview(f));const tr=await paidOnce(f);
      const module=require('../../src/services/recurrenteReconciliationService');
      const catalog=await module.loadCatalog({filters:{referencia:f.failed.id},ids:null,checkoutId:null});
      assert.equal(catalog.operations.length,1);assert.equal(catalog.operations[0].intent.id_externo,f.success.intent.id);
      assert.equal(catalog.operations[0].attempts.length,2);
      const tables=['PAGO','PAGO_ORIGEN','CHECKOUT_RECURRENTE','TRANSACCION_RECURRENTE','EVENTO_RECURRENTE','INTENTO_RECURRENTE'];
      const before=await Promise.all(tables.map(name=>q(`SELECT * FROM ${name} ORDER BY 1`)));
      const ctx={environment:'sandbox',sandboxId:TEST_SANDBOX,accountId:'ac_TEST_recovery'};
      const service=module.createReconciliationService({client:{open:async()=>({context:ctx,
        getCheckout:async id=>({id,status:'paid',amount:500,currency:'GTQ',liveMode:false,sandboxId:TEST_SANDBOX,latestIntentId:f.success.intent.id,paymentId:f.failed.payment.id}),
        getIntent:async id=>{assert.equal(id,f.success.intent.id);return {id,type:'payment',status:'succeeded',amount:500,currency:'GTQ',liveMode:false,sandboxId:TEST_SANDBOX,createdAt:f.success.intent.created_at,checkout:{id:f.local.id_externo},reason:null};}
      })}});
      const result=await service.verify({id_transaccion:tr.id_transaccion});assert.equal(result.operaciones[0].clasificacion,'CONCILIADA');
      assert.equal(result.operaciones[0].intentos.length,2);
      assert.deepEqual(await Promise.all(tables.map(name=>q(`SELECT * FROM ${name} ORDER BY 1`))),before);
    });
    test('backup/restore preserva ambos intents y auditoría de recuperación',async()=>{
      const f=await fixture();await failed(f);await engine.reprocessReview(await storedReview(f));
      const sql=await require('../../src/services/automaticBackupsService').generateSql();
      const restore=require('../../src/services/restoresService');
      const validation=restore.validateBackupPayload({filename:'recovery.sql',content:sql});
      for(const name of ['INTENTO_RECURRENTE','REVISION_EVENTO_RECURRENTE'])assert(validation.tables.includes(name));
      const target=await connect(await isolation.createOwnedRestoreDatabase(c));
      try{
        await target.query('SET FOREIGN_KEY_CHECKS=0');
        const tables=await q('SELECT TABLE_NAME name FROM information_schema.tables WHERE TABLE_SCHEMA=DATABASE()');
        for(const {name}of tables){const [ddl]=await q(`SHOW CREATE TABLE \`${name}\``);await target.query(ddl['Create Table'].replace('CREATE TABLE','CREATE TABLE IF NOT EXISTS'));}
        for(const statement of validation.statements)await target.query(statement);
        await target.query('SET FOREIGN_KEY_CHECKS=1');
        await restore.verifyRestoredReferences(target,require('../../src/database/backupTables').BACKUP_TABLES);
        for(const name of ['INTENTO_RECURRENTE','REVISION_EVENTO_RECURRENTE'])assert.deepEqual((await target.query(`SELECT * FROM ${name} ORDER BY 1`))[0],await q(`SELECT * FROM ${name} ORDER BY 1`));
      }finally{await target.end();}
    });
  });
}
