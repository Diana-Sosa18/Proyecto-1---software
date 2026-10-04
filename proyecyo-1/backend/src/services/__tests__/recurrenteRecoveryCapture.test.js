const {createHash}=require('node:crypto');
const {capturedOriginal,bodyFromCapture,main}=require('../../../scripts/reprocess-recurrente-review');
const raw=Buffer.from('{\r\n "event_type":"intent.succeeded", "texto":"á"\r\n}');
const capture=()=>({request:{method:'POST',uri:'/webhooks/recurrente',headers:{'Svix-Id':['msg_TEST_capture']},
  raw:Buffer.concat([Buffer.from('POST /webhooks/recurrente HTTP/1.1\r\nContent-Type: application/json\r\n\r\n'),raw]).toString('base64')}});
const receipt={svix_id:'msg_TEST_capture',hash_body:createHash('sha256').update(raw).digest('hex')};
test('extrae bytes originales sin reserializar, copiar headers ni hacer replay',()=>{
  expect(bodyFromCapture(capture().request.raw)).toEqual(raw);
});
test('inspector local: exige svix-id y digest exactos de la recepción original',async()=>{
  const fetchImpl=jest.fn(async()=>({ok:true,json:async()=>({requests:[capture()]})}));
  expect(await capturedOriginal(receipt,fetchImpl)).toEqual(raw);
  expect(fetchImpl.mock.calls[0][0]).toBe('http://127.0.0.1:4040/api/requests/http');
});
test.each([{...receipt,svix_id:'msg_TEST_other'},{...receipt,hash_body:'0'.repeat(64)}])('captura ajena o alterada no se recupera',async bad=>{
  await expect(capturedOriginal(bad,async()=>({ok:true,json:async()=>({requests:[capture()]})}))).rejects.toThrow('CAPTURE_UNAVAILABLE');
});
test('no reconstruye un body cuando la captura ya no está disponible',async()=>{
  await expect(capturedOriginal(receipt,async()=>({ok:true,json:async()=>({requests:[]})}))).rejects.toThrow('CAPTURE_UNAVAILABLE');
});
test.each([['--event=1','--event=2'],['--event=1','--apply','--apply']])('opciones ambiguas se rechazan antes de abrir una base',async(...args)=>{
  await expect(main(args)).rejects.toThrow('RECOVERY_OPTIONS');
});
