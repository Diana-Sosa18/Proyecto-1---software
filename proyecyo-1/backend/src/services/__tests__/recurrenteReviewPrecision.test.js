const {createHash}=require('node:crypto');
const {archiveReview}=require('../recurrenteReviewAudit');
const {readEvidence,exactTimestamp,truncatedMilliseconds,assertBinding}=require('../recurrenteReviewPrecisionRepair');
const digest=b=>createHash('sha256').update(b).digest('hex');
test('archive copies original SQL timestamp directly; no Date/timestamp parameter',async()=>{
  const c={execute:jest.fn(async()=>[{affectedRows:1,insertId:7}])};
  expect(await archiveReview(c,42,'test-operator')).toBe(7);
  expect(c.execute.mock.calls[0][0]).toMatch(/SELECT id_evento,ambiente,estado,error_codigo,intentos,procesado_en,\?/);
  expect(c.execute.mock.calls[0][1]).toEqual(['test-operator',42]);
});
test('archive refuses missing/non-review/ambiguous rows',async()=>{
  for(const affectedRows of [0,2])await expect(archiveReview({execute:async()=>[{affectedRows}]},42,'test')).rejects.toThrow('REVIEW_ARCHIVE_CONFLICT');
});
test.each(['2026-10-04 11:50:01.277859','2026-10-04 11:50:01.000001','2026-10-04 11:50:01.999999','2024-02-29 23:59:59.123456','2026-10-04 11:50:01.123000'])('exact microsecond string %s',value=>{
  expect(exactTimestamp(value)).toBe(true);expect(truncatedMilliseconds(value)).toBe(value.slice(0,23)+'000');
});
test.each([null,'2026-02-30 11:50:01.277859','2026-10-04 11:50:01.277','2026-10-04T11:50:01.277859Z'])('rejects incomplete/invalid source %s',value=>expect(exactTimestamp(value)).toBe(false));
test('evidence requires external digest, database binding, row digest and unique original IDs',()=>{
  const events=[{id_evento:42}],snapshot={database:'TEST',port:20378,rows:{EVENTO_RECURRENTE:events},tables:{EVENTO_RECURRENTE:{count:1,hash:digest(JSON.stringify(events))}}};
  const bytes=Buffer.from(JSON.stringify(snapshot));expect(readEvidence(bytes,digest(bytes),'TEST').events).toEqual(events);
  expect(()=>readEvidence(bytes,'0'.repeat(64),'TEST')).toThrow();expect(()=>readEvidence(bytes,digest(bytes),'OTHER')).toThrow();
  snapshot.rows.EVENTO_RECURRENTE[0].id_evento=43;const corrupt=Buffer.from(JSON.stringify(snapshot));expect(()=>readEvidence(corrupt,digest(corrupt),'TEST')).toThrow();
  snapshot.rows.EVENTO_RECURRENTE.push({id_evento:43});snapshot.tables.EVENTO_RECURRENTE={count:2,hash:digest(JSON.stringify(snapshot.rows.EVENTO_RECURRENTE))};const duplicated=Buffer.from(JSON.stringify(snapshot));expect(()=>readEvidence(duplicated,digest(duplicated),'TEST')).toThrow();
});
test('rejects an unrelated event or review generation even when milliseconds coincide',()=>{
  const original={id_evento:42,ambiente:'sandbox',estado:'REVISION',error_codigo:'CODE',intentos:1,svix_id:'msg_TEST'};
  const current={...original,estado:'PROCESADO',intentos:2};
  const revision={id_evento:42,ambiente:'sandbox',estado_anterior:'REVISION',error_anterior:'CODE',intentos_anteriores:1,finalizado_en:'2026-10-04 12:00:00.000001'};
  expect(()=>assertBinding(original,current,revision)).not.toThrow();
  expect(()=>assertBinding(original,{...current,svix_id:'msg_OTHER'},revision)).toThrow();
  expect(()=>assertBinding(original,current,{...revision,intentos_anteriores:2})).toThrow();
});
