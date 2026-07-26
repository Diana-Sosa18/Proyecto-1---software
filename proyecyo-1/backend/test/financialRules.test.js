const assert=require("node:assert/strict");const test=require("node:test");
const {validateRule,calculateSurcharge}=require("../src/services/financialRulesService");
const base={dia_limite:10,tipo:"PORCENTAJE",porcentaje:10,monto_fijo:0,dias_gracia:2,activo:true,vigente_desde:"2026-01-01"};
test("HU1 valida y calcula porcentaje",()=>{assert.equal(calculateSurcharge(250,validateRule(base)),25);});
test("HU1 calcula monto fijo",()=>{assert.equal(calculateSurcharge(250,validateRule({...base,tipo:"FIJO",porcentaje:0,monto_fijo:35})),35);});
test("HU1 rechaza reglas inconsistentes",()=>{assert.throws(()=>validateRule({...base,monto_fijo:5}),/incompatibles/);assert.throws(()=>validateRule({...base,porcentaje:101}),/0 y 100/);});
