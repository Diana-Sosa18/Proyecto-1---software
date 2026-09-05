import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/services/api";
type Rule={dia_limite:number;tipo:"PORCENTAJE"|"FIJO";porcentaje:number;monto_fijo:number;dias_gracia:number;activo:boolean;vigente_desde:string};
const initial:Rule={dia_limite:10,tipo:"PORCENTAJE",porcentaje:5,monto_fijo:0,dias_gracia:0,activo:true,vigente_desde:"2026-01-01"};
export function FinancialRulesSettings(){
 const [rule,setRule]=useState(initial); const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false);
 useEffect(()=>{apiRequest<Rule>("/admin/configuracion-financiera").then(setRule).catch(e=>setMessage(e.message));},[]);
 async function save(){try{setBusy(true);setRule(await apiRequest<Rule>("/admin/configuracion-financiera",{method:"PUT",body:rule}));setMessage("Configuración financiera guardada.");}catch(e){setMessage(e instanceof Error?e.message:"Error");}finally{setBusy(false);}}
 return <section className="mb-5 rounded-[20px] border bg-white p-5"><h2 className="text-lg font-semibold">Fechas límite y recargos</h2>
 <div className="mt-4 grid gap-3 md:grid-cols-3"><Input type="number" min={1} max={28} value={rule.dia_limite} onChange={e=>setRule({...rule,dia_limite:Number(e.target.value)})}/>
 <select className="rounded-md border px-3" value={rule.tipo} onChange={e=>setRule({...rule,tipo:e.target.value as Rule["tipo"],porcentaje:0,monto_fijo:0})}><option value="PORCENTAJE">Porcentaje</option><option value="FIJO">Monto fijo</option></select>
 <Input type="number" min={0} value={rule.tipo==="PORCENTAJE"?rule.porcentaje:rule.monto_fijo} onChange={e=>rule.tipo==="PORCENTAJE"?setRule({...rule,porcentaje:Number(e.target.value)}):setRule({...rule,monto_fijo:Number(e.target.value)})}/>
 <Input type="number" min={0} max={90} value={rule.dias_gracia} onChange={e=>setRule({...rule,dias_gracia:Number(e.target.value)})}/><Input type="date" value={rule.vigente_desde} onChange={e=>setRule({...rule,vigente_desde:e.target.value})}/>
 <label className="flex items-center gap-2"><input type="checkbox" checked={rule.activo} onChange={e=>setRule({...rule,activo:e.target.checked})}/>Regla activa</label></div>
 {message?<p className="mt-3 text-sm">{message}</p>:null}<Button className="mt-4" disabled={busy} onClick={save}>Guardar regla</Button></section>;
}
