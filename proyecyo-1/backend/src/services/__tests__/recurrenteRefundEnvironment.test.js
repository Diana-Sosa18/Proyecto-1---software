const { inspectRefund } = require('../recurrenteRefundContract');
const { paymentTime } = require('../recurrenteWebhookPayload');
const observed = require('../../../test/fixtures/recurrente-refund-create-observed.json');
const sandboxId = observed.sandbox_id;
const locations = ['root','refund','intentable','checkout'];
function payload(modes = {}) {
  const p = structuredClone(observed);
  const sources = { root:p, refund:p.refund, intentable:p.intentable, checkout:p.intentable.checkout };
  for (const name of locations) {
    delete sources[name].live_mode;
    if (Object.hasOwn(modes,name)) sources[name].live_mode = modes[name];
  }
  return p;
}
const inspect = p => inspectRefund(p,sandboxId,paymentTime);
test.each([
  ['A: root only',{root:false}], ['B: refund only',{refund:false}],
  ['C: intentable only',{intentable:false}], ['D: checkout only',{checkout:false}],
  ['E: intentable and checkout',{intentable:false,checkout:false}],
  ['F: refund and intentable',{refund:false,intentable:false}],
  ['G: all explicit false',{root:false,refund:false,intentable:false,checkout:false}],
])('%s proves Sandbox without guessing',(_name,modes)=>{
  expect(inspect(payload(modes))).toMatchObject({disposition:'REFUND',code:null,liveMode:false,environment:'sandbox',sandboxId});
});
test.each([
  ['H: root true with nested false',{root:true,intentable:false}],
  ['I: intentable false with checkout true',{intentable:false,checkout:true}],
])('%s is a contradiction requiring review',(_name,modes)=>{
  expect(inspect(payload(modes))).toMatchObject({disposition:'REFUND',code:'REFUND_ENVIRONMENT_CONFLICT',liveMode:null});
});
test('J: absent everywhere is not Sandbox proof',()=>expect(inspect(payload())).toMatchObject({code:'REFUND_ENVIRONMENT_UNPROVEN',liveMode:null}));
test('K: wrong Sandbox never passes',()=>expect(inspect({...payload({checkout:false}),sandbox_id:'sbx_OTHER'})).toMatchObject({code:'REFUND_ENVIRONMENT_UNPROVEN'}));
test('L: production mode cannot pass Sandbox',()=>expect(inspect(payload({checkout:true}))).toMatchObject({code:'REFUND_ENVIRONMENT_UNPROVEN',liveMode:true,environment:'production'}));
test('M: sanitized observed nested structure proves Sandbox and preserves opaque correlation',()=>{
  expect(inspect(observed)).toMatchObject({code:null,liveMode:false,parentId:observed.intentable.id,
    checkoutId:observed.intentable.checkout.id,intentId:observed.intentable.checkout.latest_intent.id,
    paymentId:observed.intentable.payment.id,refund:{id:observed.refund.id,amount:500,currency:'GTQ',status:'succeeded'}});
});
test('true + true agrees about production, but does not authorize Sandbox',()=>expect(inspect(payload({root:true,checkout:true}))).toMatchObject({code:'REFUND_ENVIRONMENT_UNPROVEN',liveMode:true,environment:'production'}));
test.each([null,'false',0,1,{},[]])('nonboolean mode %j cannot silently fall back to explicit false',mode=>{
  expect(inspect(payload({intentable:false,checkout:mode}))).toMatchObject({code:'REFUND_ENVIRONMENT_UNPROVEN',liveMode:null});
});
test.each(['refund','intentable','checkout'])('conflicting Sandbox ID in %s requires review',name=>{
  const p=payload({intentable:false});const source=name==='checkout'?p.intentable.checkout:p[name];source.sandbox_id='sbx_OTHER';
  expect(inspect(p).code).toBe('REFUND_ENVIRONMENT_UNPROVEN');
});
