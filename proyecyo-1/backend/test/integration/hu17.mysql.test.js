const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { configureTestEnvironment, connect } = require('./support/isolatedMysql');
if (process.env.RUN_PHASE0_MYSQL_TESTS !== '1') {
  test('HU17 exige MySQL temporal aislado', { skip: true }, () => {});
} else {
  require('./support/suiteIsolation').assertOwnedSuiteDatabase(); configureTestEnvironment();
  const db = require('../../src/database/mysql');
  const { createReconciliationService, loadCatalog } = require('../../src/services/recurrenteReconciliationService');
  const { QUOTA_BALANCES_SQL } = require('../../src/services/financialBalance');
  const originalFetch = global.fetch;
  global.fetch = (url, options) => { assert.equal(new URL(url).hostname, '127.0.0.1', 'Prohibited external request'); return originalFetch(url,options); };
  let conn, server, base, service, catalog, stateBefore, admin, resident, calls = 0;
  const query = async (sql,params=[]) => (await conn.query(sql,params))[0];
  async function snapshot() {
    const out = {};
    for (const table of ['CUOTA','RECARGO_APLICADO','PAGO','PAGO_ORIGEN','CHECKOUT_RECURRENTE','TRANSACCION_RECURRENTE','EVENTO_RECURRENTE','REEMBOLSO_RECURRENTE']) out[table] = await query(`SELECT * FROM ${table} ORDER BY 1`);
    return out;
  }
  const criteria = filters => ({ filters, ids:null, checkoutId:null });
  const one = r => { assert.equal(r.operaciones.length,1); return r.operaciones[0]; };
  async function http(path,token=admin,body) {
    return fetch(base+path,{ method:body ? 'POST':'GET', headers: { ...(token ? {Authorization:`Bearer ${token}`} : {}), 'Content-Type':'application/json' }, ...(body ? {body:JSON.stringify(body)} : {}) });
  }
  describe('HU17 MySQL temporal: lectura financiera, sesión real y proveedor mock', { concurrency:false }, () => {
    before(async () => {
      conn = await connect(); stateBefore = await snapshot();
      catalog = await loadCatalog(criteria({}));
      const paid = catalog.operations.find(v => v.intent?.id_transaccion===296);
      const ctx = { environment:'sandbox',sandboxId:paid.checkout.sandbox_id,accountId:'ac_HU17_FAKE' };
      // Provider evidence projected from TEST fixture rows; no real provider client.
      const session = { context:ctx,
        async getCheckout(id) { calls++; const l=catalog.operations.find(v=>v.checkout.id_externo===id); assert(l);
          return { id, status:l.checkout.estado_proveedor,amount:l.checkout.monto_centavos,currency:l.checkout.moneda,liveMode:false,
            sandboxId:ctx.sandboxId,createdAt:null,latestIntentId:l.intent?.id_externo,paymentId:l.intent?.estado==='CONFIRMADA'?l.intent.id_pago_externo:null }; },
        async getIntent(id) { calls++; const l=catalog.operations.find(v=>v.intent?.id_externo===id); assert(l);
          return { id,type:'payment',status:{CONFIRMADA:'succeeded',FALLIDA:'failed',CANCELADA:'canceled',PENDIENTE:'pending'}[l.intent.estado],
            amount:l.intent.monto_centavos,currency:l.intent.moneda,liveMode:false,sandboxId:ctx.sandboxId,createdAt:l.intent.fecha_proveedor_original,
            checkout:{id:l.checkout.id_externo},reason:null }; }
      };
      service=createReconciliationService({client:{open:async()=>session}});
      const { createActiveSession }=require('../../src/services/activeSessionsService');
      admin=(await createActiveSession(1)).token; resident=(await createActiveSession(3)).token;
      server=require('../../src/app').createApp({recurrenteReconciliationService:service}).listen(0,'127.0.0.1');
      await new Promise(r=>server.once('listening',r)); base=`http://127.0.0.1:${server.address().port}`;
    });
    after(async()=>{ try { assert.deepEqual(await snapshot(),stateBefore,'ALL financial rows unchanged, including verification timestamps/events/refunds'); }
      finally { if(server)await new Promise(r=>server.close(r)); await conn?.end(); await db.pool.end(); global.fetch=originalFetch; } });
    test('GET local no consulta al proveedor y conserva eventos sin multiplicar filas',async()=>{
      const previous=calls, r=await service.list({referencia:'296'}); assert.equal(calls,previous); assert.equal(one(r).id_pago,395); assert.equal(r.verificado,false);
      assert(one(r).eventos.length>=1);
    });
    test('succeeded/paid/CONFIRMADA/PAGO 395 se concilia',async()=>{const op=one(await service.verify({id_transaccion:296})); assert.equal(op.clasificacion,'CONCILIADA'); assert.equal(op.id_pago,395);});
    test('FALLIDA 486/unpaid 937/sin PAGO se concilia',async()=>{const op=one(await service.verify({id_transaccion:486})); assert.equal(op.clasificacion,'CONCILIADA'); assert.equal(op.id_pago,null); assert.equal(op.saldo_actual_centavos,500);});
    for(const reference of ['296','433','171','in_y4hil51d','ch_orahuujriakj0kgk','pa_xzdhbyna','NXR-00000395']) test(`referencia SQL exacta ${reference}`,async()=>assert.equal(one(await service.list({referencia:reference})).id_transaccion,296));
    test('referencia UUID local',async()=>assert.equal(one(await service.list({referencia:catalog.operations.find(v=>v.intent?.id_transaccion===296).checkout.referencia_local})).id_transaccion,296));
    test('filtro estado FALLIDA',async()=>{const r=await service.list({estado_local:'FALLIDA'}); assert(r.operaciones.length); assert(r.operaciones.every(v=>v.interno.estado_transaccion==='FALLIDA'));});
    test('filtro residente correcto y residente ajeno',async()=>{assert((await service.list({residente:'1'})).operaciones.length); assert.deepEqual((await service.list({residente:'2147483647'})).operaciones,[]);});
    test('filtro resultado aplica clasificación sin perder resumen',async()=>{const r=await service.verify({filtros:{referencia:'296',resultado:'DIFERENCIA'}});assert.equal(r.operaciones.length,0);assert.equal(r.resumen.conciliadas,1);});
    test('fecha contable real incluye 2026-10-02, excluye períodos ajenos; saldo no se recalcula por período',async()=>{
      const yes=await service.list({desde:'2026-10-02',hasta:'2026-10-02',referencia:'296'}); assert.equal(one(yes).saldo_actual_centavos,0);
      assert.equal((await service.list({desde:'2030-01-01',hasta:'2030-01-02',referencia:'296'})).operaciones.length,0);
    });
    test('operación sin fecha permanece visible y explícita',async()=>{const r=await service.list({desde:'2030-01-01',hasta:'2030-01-02',referencia:'486'});
      // HU15 fixture may have an official date. If present it must obey the filter.
      const l=catalog.operations.find(v=>v.intent?.id_transaccion===486); if(l.intent.fecha_proveedor_original) assert.equal(r.operaciones.length,0); else assert.equal(one(r).sin_fecha_verificable,true);
    });
    test('consultas repetidas y simultáneas no duplican abonos ni cambian timestamp HU15',async()=>{
      const before=await snapshot(); const results=await Promise.all([service.verify({id_transaccion:296}),service.verify({id_transaccion:296}),service.verify({id_transaccion:486})]);
      assert(results.every(r=>r.operaciones[0].clasificacion==='CONCILIADA')); assert.deepEqual(await snapshot(),before);
    });
    test('ADMIN con sesión activa en DB accede a ambos endpoints',async()=>{
      assert.equal((await http('/admin/pagos/recurrente/transacciones?referencia=296')).status,200);
      const r=await http('/admin/pagos/recurrente/conciliacion',admin,{id_transaccion:296});assert.equal(r.status,200);assert.equal(one(await r.json()).clasificacion,'CONCILIADA');assert.equal(r.headers.get('cache-control'),'private, no-store');
    });
    test('RESIDENTE se rechaza antes de proveedor',async()=>{const n=calls;assert.equal((await http('/admin/pagos/recurrente/conciliacion',resident,{id_transaccion:296})).status,403);assert.equal(calls,n);});
    test('headers falsificados sin sesión no acceden',async()=>{const n=calls;const r=await fetch(base+'/admin/pagos/recurrente/conciliacion',{method:'POST',headers:{'Content-Type':'application/json','x-user-id':'1','x-user-role':'admin'},body:'{}'});assert.equal(r.status,401);assert.equal(calls,n);});
    test('sesión revocada en DB no accede',async()=>{const {createActiveSession}=require('../../src/services/activeSessionsService');const s=await createActiveSession(1);
      await query('UPDATE SESION_ACTIVA SET revocada_en=NOW() WHERE id_sesion=?',[s.sessionId]);
      const n=calls;assert.equal((await http('/admin/pagos/recurrente/conciliacion',s.token,{id_transaccion:296})).status,401);assert.equal(calls,n);
    });
    test('rechaza importes y estados suministrados por frontend',async()=>{const n=calls;assert.equal((await http('/admin/pagos/recurrente/conciliacion',admin,{id_transaccion:296,monto_centavos:999})).status,400);assert.equal(calls,n);});
    test('fuente de verdad mantiene cuotas 171=0 y 998=5, un solo PAGO y una FALLIDA',async()=>{
      assert.deepEqual((await query(`SELECT id_cuota,saldo_pendiente FROM (${QUOTA_BALANCES_SQL}) b WHERE id_cuota IN(171,998) ORDER BY id_cuota`)).map(v=>[v.id_cuota,Number(v.saldo_pendiente)]),[[171,0],[998,5]]);
      assert.deepEqual((await query('SELECT id_pago,monto_pagado FROM PAGO WHERE id_cuota=171')).map(v=>[v.id_pago,Number(v.monto_pagado)]),[[395,5]]);
      assert.equal((await query('SELECT COUNT(*) n FROM PAGO WHERE id_cuota=998'))[0].n,0);assert.deepEqual(await snapshot(),stateBefore);
    });
  });
}
