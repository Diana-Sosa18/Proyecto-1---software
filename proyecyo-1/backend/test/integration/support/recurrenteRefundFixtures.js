const { randomUUID } = require('node:crypto');
const { createWebhookService } = require('../../../src/services/recurrenteWebhookService');
const { verifyWebhook, inspectEvent, paymentTime } = require('../../../src/services/recurrenteWebhookPayload');
const { configuration, observedPaymentPair, signed, TEST_SANDBOX } = require('./recurrenteWebhookFixtures');
const context = { environment:'sandbox', sandboxId:TEST_SANDBOX, accountId:'ac_HU18_FAKE' };
const evidence = (amount=500, changes={}) => ({ id:`re_TEST_${randomUUID().replaceAll('-','')}`,status:'succeeded',amount,currency:'GTQ',
  merchantAmount:Math.max(0,amount-17),accountId:context.accountId,time:paymentTime('2026-10-03T02:30:00.123456Z'),reason:null,...changes });
function delivery(payload, svixId) {
  const f=signed(payload,svixId?{svixId}:{}), v=verifyWebhook(f.raw,f.headers,configuration());
  return {...v,event:inspectEvent(v.payload,TEST_SANDBOX),sandboxId:TEST_SANDBOX};
}
function refundPayload(fixture, refund, changes={}) {
  return {event_type:'refund.create',sandbox_id:TEST_SANDBOX,live_mode:false,
    intentable:{id:fixture.pairs[0].paymentIntent.id,type:'PaymentIntent'},
    refund:{id:refund.id,status:refund.status,customer_refunded_amount_in_cents:refund.amount,
      account_refunded_amount_in_cents:refund.merchantAmount,currency:refund.currency,created_at:refund.time?.original},...changes};
}
function observedRefundPayload(fixture, refund) {
  const payload=structuredClone(require('../../fixtures/recurrente-refund-create-observed.json'));
  const parent=payload.intentable,co=parent.checkout,tr=fixture.transactions[0];
  parent.id=fixture.pairs[0].paymentIntent.id;parent.amount_in_cents=Number(tr.monto_centavos);
  parent.payment.id=tr.id_pago_externo;co.id=fixture.local[0].id_externo;co.total_in_cents=Number(tr.monto_centavos);
  co.payment.id=tr.id_pago_externo;co.latest_intent.id=tr.id_externo;
  payload.refund={...payload.refund,id:refund.id,status:refund.status,customer_refunded_amount_in_cents:refund.amount,
    account_refunded_amount_in_cents:refund.merchantAmount,account_id:refund.accountId,currency:refund.currency,
    created_at:refund.time?.original};
  return payload;
}
async function paidFixture(connection,{principal='5.00',surcharge='0.00',payments=[500],deadline='2026-10-08'}={}) {
  const q=async(sql,args=[]) => (await connection.query(sql,args))[0];
  const id=(await q('INSERT INTO CUOTA(id_servicio,id_casa,monto,fecha_limite) VALUES(1,1,?,?)',[principal,deadline])).insertId;
  if(Number(surcharge))await q("INSERT INTO RECARGO_APLICADO(id_cuota,id_casa,tipo_regla,monto_original,monto_recargo,fecha_aplicacion) VALUES(?,1,'FIJO',?,?,'2026-10-01')",[id,principal,surcharge]);
  const local=[], pairs=[];
  for(const amount of payments) {
    const co={referencia_local:randomUUID(),id_externo:`ch_TEST_${randomUUID().replaceAll('-','')}`,idempotency_key:randomUUID(),
      id_cuota:id,id_usuario:3,id_residente:1,id_casa:1,monto_centavos:amount,capital_centavos:amount,recargo_centavos:0,
      moneda:'GTQ',ambiente:'sandbox',sandbox_id:TEST_SANDBOX,estado:'PENDIENTE',estado_proveedor:'unpaid'};
    co.id_checkout=(await q('INSERT INTO CHECKOUT_RECURRENTE SET ?',co)).insertId;
    const pair=observedPaymentPair(co), input=delivery(pair.paymentIntent);
    const result=await createWebhookService().receive(input);
    if(result!=='processed'){const [ev]=await q('SELECT error_codigo FROM EVENTO_RECURRENTE WHERE svix_id=?',[input.svixId]);throw new Error('Fixture payment: '+result+' '+ev?.error_codigo);}
    local.push(co);pairs.push(pair);
  }
  const transactions=await q('SELECT * FROM TRANSACCION_RECURRENTE WHERE id_cuota=? ORDER BY id_transaccion',[id]);
  return {id,local,pairs,transactions};
}
function assertProcessed(result){if(result!=='processed')throw new Error('Fixture payment not applied');}
function mockClient({reply,send,get,open}={}) {
  let posts=0,gets=0;
  return { sandboxId:()=>TEST_SANDBOX,counts:()=>({posts,gets}),
    async open(local){if(open)await open(local);return {context,async send(row,mark){await mark();posts++;return send?send(row,local):reply||evidence(Number(row.monto_centavos));}};},
    async getRefund(id){gets++;return {context,refund:get?await get(id):reply};} };
}
module.exports={context,evidence,delivery,refundPayload,observedRefundPayload,paidFixture,mockClient};
