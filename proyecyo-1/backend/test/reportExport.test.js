const assert=require("node:assert/strict"),test=require("node:test"),s=require("../src/services/reportExportService");
test("HU13 valida formatos",()=>{assert.deepEqual(s.validate("accesos","pdf"),{type:"accesos",format:"pdf"});assert.throws(()=>s.validate("otro","pdf"),/Reporte/);assert.throws(()=>s.validate("accesos","csv"),/Formato/)});
test("HU13 neutraliza fórmulas",()=>{assert.equal(s.safe("=CMD()"),"'=CMD()");assert.equal(s.safe("normal"),"normal")});
test("HU13 valida filtros",()=>{assert.deepEqual(s.validateFilters({desde:"2026-01-01",hasta:"2026-12-31"}),{desde:"2026-01-01",hasta:"2026-12-31"});assert.throws(()=>s.validateFilters({desde:"2026-12-31",hasta:"2026-01-01"}),/rango/)});
test("HU13 genera PDF y XLSX reales",async()=>{const p=await s.pdf("accesos",[{nombre:"Ana"}],1),x=await s.excel("accesos",[{nombre:"Ana"}],1);assert.equal(p.subarray(0,4).toString(),"%PDF");assert.equal(x.subarray(0,2).toString(),"PK")});
