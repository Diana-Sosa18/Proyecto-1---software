// Privileged local TEST operation, never a public unsigned-webhook endpoint.
// Default is read-only. --apply is an explicit financial recovery, not a new payment.
const { createHash }=require('node:crypto');
function bodyFromCapture(raw) {
  const bytes=Buffer.from(raw,'base64'),separator=bytes.indexOf(Buffer.from('\r\n\r\n'));
  if(separator<0) throw new Error('CAPTURE_UNAVAILABLE');
  return bytes.subarray(separator+4);
}
async function capturedOriginal(receipt,fetchImpl=fetch) {
  const response=await fetchImpl('http://127.0.0.1:4040/api/requests/http',{signal:AbortSignal.timeout(5000)});
  if(!response.ok) throw new Error('CAPTURE_UNAVAILABLE');
  const captures=await response.json();
  for(const capture of captures.requests||[]) {
    if(capture.request?.method!=='POST'||capture.request?.uri!=='/webhooks/recurrente') continue;
    const headers=capture.request.headers||{},key=Object.keys(headers).find(k=>k.toLowerCase()==='svix-id');
    const value=Array.isArray(headers[key])?headers[key][0]:headers[key];
    if(value!==receipt.svix_id) continue;
    const body=bodyFromCapture(capture.request.raw);
    if(createHash('sha256').update(body).digest('hex')===receipt.hash_body) return body;
  }
  throw new Error('CAPTURE_UNAVAILABLE');
}
async function main(args=process.argv.slice(2)) {
  if(new Set(args).size!==args.length || args.filter(a=>a.startsWith('--event=')).length>1
    || args.some(a=>!['--prepare-schema','--apply'].includes(a)&&!/^--event=\d+$/.test(a))) throw new Error('RECOVERY_OPTIONS');
  const prepare=args.includes('--prepare-schema'),apply=args.includes('--apply');
  const eventId=Number(args.find(a=>a.startsWith('--event='))?.slice(8));
  if(prepare&&(apply||eventId)||!prepare&&(!Number.isSafeInteger(eventId)||eventId<=0)) throw new Error('RECOVERY_OPTIONS');
  const config=require('./start-hu13-sandbox').configureManualEnvironment();
  const db=require('../src/database/mysql');
  try {
    const c=await db.pool.getConnection();let receipt;
    try {
      const [identity]=await c.query('SELECT DATABASE() db');
      if(identity[0].db!==config.database) throw new Error('RECOVERY_DATABASE');
      if(prepare) {
        await require('../src/database/recurrenteMigration').applyRecurrenteIntentHistoryMigration(c);
        console.info(JSON.stringify({migration:'006',database:config.database,financialRowsModified:0}));return;
      }
      const [rows]=await c.execute('SELECT * FROM EVENTO_RECURRENTE WHERE id_evento=?',[eventId]);receipt=rows[0];
    }finally{c.release();}
    const {sandboxId}=require('../src/config/recurrenteWebhook').getWebhookConfig();
    if(!receipt||!['REVISION','PROCESADO'].includes(receipt.estado)||receipt.ambiente!=='sandbox'
      ||receipt.sandbox_id!==sandboxId) throw new Error('RECOVERY_RECEIPT');
    const body=await capturedOriginal(receipt);let payload=JSON.parse(body.toString('utf8'));
    if(payload.data?.event_type!==undefined){if(payload.event_type!==undefined)throw new Error('RECOVERY_RECEIPT');payload=payload.data;}
    const event=require('../src/services/recurrenteWebhookPayload').inspectEvent(payload,sandboxId);
    const {previewReview,reviewReceiptMatches}=require('../src/services/recurrenteRecoveryPreview');
    if(!reviewReceiptMatches(receipt,event,sandboxId)) throw new Error('RECOVERY_RECEIPT');
    if(!apply){
      const read=await db.pool.getConnection();let preview;
      try {
        await read.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
        const [current]=await read.execute('SELECT * FROM EVENTO_RECURRENTE WHERE id_evento=?',[eventId]);
        if(current[0]?.hash_body!==receipt.hash_body)throw new Error('RECOVERY_RECEIPT');
        preview=await previewReview(read,{receipt:current[0],event,sandboxId});
        await read.rollback();
      } catch(error){await read.rollback();throw error;}finally{read.release();}
      console.info(JSON.stringify({mode:'read-only',eventId,database:config.database,hashMatches:true,normalization:event.disposition,...preview}));return;
    }
    const result=await require('../src/services/recurrenteWebhookService').createWebhookService().reprocessReview({eventId,originalBody:body,sandboxId,operator:'local-test-operator'});
    console.info(JSON.stringify({mode:'recovery',eventId,result,database:config.database}));
  }finally{await db.pool.end();}
}
if(require.main===module)main().catch(()=>{console.error('Recuperación detenida. Verifica base TEST, migración 006, evento firmado y captura original disponible.');process.exitCode=1;});
module.exports={main,capturedOriginal,bodyFromCapture};
