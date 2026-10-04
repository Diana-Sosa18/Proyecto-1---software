jest.mock('../../database/mysql',()=>({pool:{},query:jest.fn()}));
const {randomUUID}=require('node:crypto');
const {calculateBalance}=require('../financialBalance');
const {RefundError,normalizeRefund,inspectRefund}=require('../recurrenteRefundContract');
const {paymentTime}=require('../recurrenteWebhookPayload');
const {__private__:rules}=require('../recurrenteRefundService');
const {createRecurrenteRefundClient}=require('../recurrenteRefundClient');
const {createRecurrenteReadClient}=require('../recurrenteReadClient');
const config={secretKey:'HU18_FAKE_OPAQUE_KEY',sandboxId:'sbx_HU18_FAKE',timeoutMs:30};
const local={id_externo:'in_HU18_FAKE',id_pago_externo:'pa_PAYMENT_FAKE',checkout_externo:'ch_HU18_FAKE',monto_centavos:500,
  checkout_monto:500,moneda:'GTQ',ambiente:'sandbox',sandbox_id:config.sandboxId};
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json'}});
const refund={id:'re_HU18_FAKE',status:'succeeded',customer_refunded_amount_in_cents:500,account_refunded_amount_in_cents:483,
  currency:'GTQ',created_at:'2026-10-03T02:30:00Z',account_id:'ac_HU18_FAKE'};
function setup({context={},intent={},checkout={}}={}) {
 const fetchImpl=jest.fn().mockResolvedValueOnce(json({environment:'sandbox',sandbox_id:config.sandboxId,account_id:'ac_HU18_FAKE',...context}))
  .mockResolvedValueOnce(json({id:local.id_externo,type:'payment',status:'succeeded',amount_in_cents:500,currency:'GTQ',created_at:'2026-10-02T18:00:00Z',checkout:{id:local.checkout_externo},...intent}))
  .mockResolvedValueOnce(json({id:local.checkout_externo,status:'paid',total_in_cents:500,currency:'GTQ',live_mode:false,
    latest_intent:{id:local.id_externo},payment:{id:local.id_pago_externo},...checkout}));
 return {fetchImpl,client:createRecurrenteRefundClient({fetchImpl,configuration:()=>config,now:()=>new Date('2026-10-03T18:00:00Z')})};
}
test.each([[5,5,5,0],[115,50,50,0],[115,115,100,15],[50,10,75,0]])('neto global bruto %s devuelto %s mantiene recargos primero',(gross,returned,capital,surcharge)=>{
 const b=calculateBalance({monto:gross===5?5:100,recargo:gross===5?0:15,pagado:gross,reembolsado:returned});
 expect(b).toMatchObject({pagado:gross,reembolsado:returned,abono_neto:gross-returned,capital_pendiente:capital,recargo_pendiente:surcharge});
});
test('rechaza devolución superior al bruto sin saldo negativo silencioso',()=>expect(()=>calculateBalance({monto:5,pagado:5,reembolsado:6})).toThrow(/superiores/));
test('importe cliente y comercio se distinguen',()=>expect(normalizeRefund(refund,paymentTime)).toMatchObject({amount:500,merchantAmount:483,time:{accountingDate:'2026-10-02'}}));
test.each([{}, {...refund,id:'pa_WRONG'}, {...refund,customer_refunded_amount_in_cents:5.5}, {...refund,status:'paid'}, {...refund,created_at:'2026-10-03'}])('respuesta inválida no confirma',v=>expect(()=>normalizeRefund(v,paymentTime)).toThrow(RefundError));
test('descarta tarjeta, customer, headers, secreto y texto arbitrario de fallo',()=>{
 const normalized=normalizeRefund({...refund,customer:{pan:'FAKE_ONLY'},secret:'FAKE_ONLY',failure_reason:'FAKE_ONLY'},paymentTime);
 expect(JSON.stringify(normalized)).not.toContain('FAKE_ONLY');
});
test.each([{amount:1},{moneda:'USD'},{intent_id:'in_FAKE'},{saldo:0},{tipo:'PARCIAL'}])('API rechaza autoridad frontend %j',extra=>expect(()=>rules.requestInput({motivo:'Error administrativo',idempotency_key:randomUUID(),...extra})).toThrow(RefundError));
test.each(['','x'.repeat(501),'<script>','1234 5678 9012 3456','CVC 123','\nunsafe','whsec_FAKE_ONLY','sk_live_FAKE_ONLY'])('motivo inválido no se persiste %s',motivo=>expect(()=>rules.requestInput({motivo,idempotency_key:randomUUID()})).toThrow());
test('motivo normalizado y fingerprint utiliza motivo estable',()=>expect(rules.requestInput({motivo:'  Error administrativo  ',idempotency_key:randomUUID()}).motivo).toBe('Error administrativo'));
test.each([{environment:'production'},{sandbox_id:'sbx_OTHER'},{account_id:null}])('preflight Sandbox incoherente bloquea POST %j',async context=>{
 const {client,fetchImpl}=setup({context});await expect(client.open(local)).rejects.toThrow();expect(fetchImpl.mock.calls.every(([,o])=>o.method==='GET')).toBe(true);
});
test.each([{status:'failed'},{id:'pa_LEGACY_WRONG'},{amount_in_cents:501},{currency:'USD'},{created_at:'2026-08-01T00:00:00Z'}])('evidencia intent insuficiente bloquea %j',async intent=>{const {client}=setup({intent});await expect(client.open(local)).rejects.toThrow();});
test.each([{status:'unpaid'},{live_mode:true},{payment:{id:'pa_LEGACY_NOT_PAYMENT'}},{latest_intent:{id:'in_OTHER'}}])('checkout inconsistente bloquea %j',async checkout=>{const {client}=setup({checkout});await expect(client.open(local)).rejects.toThrow();});
test('POST canónico total, Idempotency-Key y Secret Key solo backend; sin motivo/amount/payment pa',async()=>{
 const {client,fetchImpl}=setup();fetchImpl.mockResolvedValueOnce(json(refund));const s=await client.open(local),mark=jest.fn();const key=randomUUID();
 const r=await s.send({idempotency_key:key},mark);expect(mark).toHaveBeenCalledTimes(1);expect(r.amount).toBe(500);
 const [url,o]=fetchImpl.mock.calls.at(-1);expect(url).toBe('https://app.recurrente.com/api/refunds');expect(JSON.parse(o.body)).toEqual({intent_id:local.id_externo});
 expect(o.headers['Idempotency-Key']).toBe(key);expect(o.headers['X-SECRET-KEY']).toBe(config.secretKey);expect(JSON.stringify(r)).not.toContain(config.secretKey);
});
test.each([400,401,403,404,422,429])('HTTP %s definitivo no confirma ni se reenvía',async status=>{
 const {client,fetchImpl}=setup();fetchImpl.mockResolvedValueOnce(json({headers:{secret:'FAKE_ONLY'}},status));const s=await client.open(local);
 await expect(s.send({idempotency_key:randomUUID()},async()=>{})).rejects.toMatchObject({uncertain:false,code:'REFUND_PROVIDER_REJECTED'});expect(fetchImpl).toHaveBeenCalledTimes(4);
});
test.each([500,502,503])('HTTP %s reserva como incierto sin retry',async status=>{const {client,fetchImpl}=setup();fetchImpl.mockResolvedValueOnce(json({},status));const s=await client.open(local);await expect(s.send({idempotency_key:randomUUID()},async()=>{})).rejects.toMatchObject({uncertain:true});expect(fetchImpl).toHaveBeenCalledTimes(4);});
test('202 nunca aplica aunque declare succeeded',async()=>{const {client,fetchImpl}=setup();fetchImpl.mockResolvedValueOnce(json(refund,202));const s=await client.open(local);expect((await s.send({idempotency_key:randomUUID()},async()=>{})).status).toBe('pending');});
test('422 con refund_id conserva referencia y reserva',async()=>{const {client,fetchImpl}=setup();fetchImpl.mockResolvedValueOnce(json({refund_id:refund.id},422));const s=await client.open(local);await expect(s.send({idempotency_key:randomUUID()},async()=>{})).rejects.toMatchObject({uncertain:true,refund:{id:refund.id}});});
test('timeout después del envío no reintenta',async()=>{const {client,fetchImpl}=setup();fetchImpl.mockImplementationOnce(()=>new Promise(()=>{}));const s=await client.open(local);await expect(s.send({idempotency_key:randomUUID()},async()=>{})).rejects.toMatchObject({uncertain:true});expect(fetchImpl).toHaveBeenCalledTimes(4);});
test.each([null,{},'garbage'])('HTTP200 sin contrato no es éxito %j',async v=>{const {client,fetchImpl}=setup();fetchImpl.mockResolvedValueOnce(json(v));const s=await client.open(local);await expect(s.send({idempotency_key:randomUUID()},async()=>{})).rejects.toMatchObject({uncertain:true});});
test('GET únicamente refund conocido, nunca lista ni void',async()=>{
 const fetchImpl=jest.fn().mockResolvedValueOnce(json({environment:'sandbox',sandbox_id:config.sandboxId,account_id:'ac_HU18_FAKE'})).mockResolvedValueOnce(json(refund));
 const session=await createRecurrenteReadClient({fetchImpl,configuration:()=>config}).open();expect((await session.getRefund(refund.id)).amount).toBe(500);
 expect(fetchImpl.mock.calls.every(([,o])=>o.method==='GET')).toBe(true);expect(fetchImpl.mock.calls.at(-1)[0]).toBe('https://app.recurrente.com/api/refunds/'+refund.id);
 await expect(session.getRefund('pa_NOT_REFUND')).rejects.toThrow();expect(fetchImpl).toHaveBeenCalledTimes(2);
});
test('refund.create sin modo/Sandbox no inventa evidencia',()=>expect(inspectRefund({event_type:'refund.create',refund},config.sandboxId,paymentTime)).toMatchObject({code:'REFUND_ENVIRONMENT_UNPROVEN',liveMode:null,disposition:'REFUND'}));
test('intentable PaymentIntent exige legacy intent pa, nunca physical payment por su prefijo',()=>{
 const event=inspectRefund({event_type:'refund.create',sandbox_id:config.sandboxId,live_mode:false,refund,intentable:{id:'pa_LEGACY',type:'PaymentIntent'}},config.sandboxId,paymentTime);
 expect(event.parentId).toBe('pa_LEGACY');expect(event.code).toBeNull();
});

const historical={...local,id_pago:10,origen:'RECURRENTE',pago_ambiente:'sandbox',estado:'CONFIRMADA',confirmado_en:'2026-10-02',checkout_estado:'CONFIRMADO',checkout_proveedor:'paid',checkout_moneda:'GTQ',monto_pagado:'5.00',id_cuota:1,checkout_cuota:1,id_usuario:3,checkout_usuario:3,id_casa:1,checkout_casa:1,cuota_casa:1,residente_usuario:3,id_residente:1,actual_residente:1,capital_aplicado_centavos:500,recargo_aplicado_centavos:0};
test('original históricamente confirmado es elegible con asociaciones coherentes',()=>expect(rules.eligibleLocal(historical,config.sandboxId)).toBe(true));
test.each([['estado','FALLIDA'],['estado','CANCELADA'],['estado','PENDIENTE'],['origen','SIMULADO'],['origen','HISTORICO'],['id_pago',null],['id_pago_externo',null],['id_externo','pa_NOT_CANONICAL'],['moneda','USD'],['ambiente','production'],['sandbox_id','sbx_OTHER'],['monto_pagado','6.00'],['capital_aplicado_centavos',null],['residente_usuario',4]])('inelegible %s=%s antes de POST',(k,v)=>expect(rules.eligibleLocal({...historical,[k]:v},config.sandboxId)).toBe(false));
test('confirmed legacy sin marcador conserva reserva y requiere revisión',()=>expect(rules.budget(historical,[{estado:'CONFIRMADO',aplicado_en:null,monto_centavos:500}])).toMatchObject({devuelto_centavos:0,reservado_centavos:500,disponible_centavos:0}));
test('límite acumulado no permite exceder pago original',()=>expect(()=>rules.budget(historical,[{estado:'CONFIRMADO',aplicado_en:'TEST',monto_centavos:501}])).toThrow());

test.each(['sin referencia','sin aplicación','sin fecha externa'])('HU17 refund confirmado %s conserva cobertura pendiente y no muta finanzas',mode=>{
 const {local,observation}=require('../../../test/fixtures/hu17').fixture();
 const rr={id_reembolso:1,id_externo:'re_HU18_FAKE',estado:'CONFIRMADO',monto_centavos:500,moneda:'GTQ',aplicado_en:'2026-10-03',fecha_contable:'2026-10-02',capital_revertido_centavos:500,recargo_revertido_centavos:0};
 if(mode==='sin referencia')rr.id_externo=null;
 if(mode==='sin aplicación')rr.aplicado_en=null;
 else local.intent.estado='REEMBOLSADA';
 local.refunds=[rr];observation.refunds=[{id:'re_HU18_FAKE',status:'succeeded',amount:500,currency:'GTQ',time:mode==='sin fecha externa'?null:paymentTime('2026-10-03T02:30:00Z')}];
 const before=JSON.stringify(local),result=require('../recurrenteReconciliationCompare').compareOperation(local,observation);
 expect(result.clasificacion).toBe('PENDIENTE');expect(result.faltantes.length).toBeGreaterThan(0);expect(JSON.stringify(local)).toBe(before);
});
