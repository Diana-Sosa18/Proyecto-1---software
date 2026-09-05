const assert=require("node:assert/strict"),test=require("node:test"),{monthRange}=require("../src/services/residentMonthlySummaryService");
test("HU7 límites mensuales",()=>{assert.deepEqual(monthRange(2026,12),{start:"2026-12-01",next:"2027-01-01"});assert.deepEqual(monthRange(2024,2),{start:"2024-02-01",next:"2024-03-01"})});
test("HU7 período inválido",()=>assert.throws(()=>monthRange(2026,13),/inválido/));
