const assert=require("node:assert/strict"),test=require("node:test"),{pagination,filters}=require("../src/services/sanctionHistoryService");
test("HU12 paginación",()=>assert.deepEqual(pagination({page:2,limit:20}),{page:2,limit:20,offset:20}));
test("HU12 limita paginación a enteros seguros",()=>{assert.deepEqual(pagination({page:"x",limit:"500; DROP TABLE SANCION"}),{page:1,limit:20,offset:0});assert.equal(pagination({page:"3",limit:"500"}).limit,100);});
test("HU12 rango inválido",()=>assert.throws(()=>filters({desde:"2026-12-01",hasta:"2026-01-01"}),/rango/));
