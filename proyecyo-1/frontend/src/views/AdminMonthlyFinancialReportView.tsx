import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/services/api";

type Report = { resumen: Record<string, number>; detalle: Array<{ id_casa:number; unidad:string; usuario:string; concepto:string; monto:number; recargo:number; pagado:number; pendiente:number; fecha_limite:string; estado:string }> };
const money = (value:number) => new Intl.NumberFormat("es-GT", { style:"currency", currency:"GTQ" }).format(value);
export function AdminMonthlyFinancialReportView() {
  const now = new Date(); const [mes,setMes]=useState(now.getMonth()+1); const [anio,setAnio]=useState(now.getFullYear());
  const [report,setReport]=useState<Report|null>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState("");
  async function load(){try{setLoading(true);setError("");setReport(await apiRequest<Report>(`/admin/reportes/financiero-mensual?mes=${mes}&anio=${anio}`));}catch(e){setError(e instanceof Error?e.message:"No fue posible cargar el reporte.");}finally{setLoading(false);}}
  useEffect(()=>{void load();},[]);
  return <AdminLayout title="Reporte financiero mensual" subtitle="Pagos y mora del residencial por periodo.">
    <div className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-3"><select aria-label="Mes" value={mes} onChange={e=>setMes(Number(e.target.value))} className="rounded-md border p-2">{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select><input aria-label="Año" type="number" value={anio} onChange={e=>setAnio(Number(e.target.value))} className="rounded-md border p-2"/><Button onClick={()=>void load()}>Consultar</Button></div>
    {error?<p className="mt-4 rounded-lg bg-rose-50 p-3 text-rose-700">{error}</p>:null}
    {loading?<p className="mt-4">Cargando reporte...</p>:report?<><div className="mt-4 grid gap-3 md:grid-cols-5">{[["Total cobrado",report.resumen.total_cobrado],["Total pendiente",report.resumen.total_pendiente],["Total en mora",report.resumen.total_mora],["Pagos",report.resumen.cantidad_pagos],["Usuarios morosos",report.resumen.usuarios_morosos]].map(([l,v])=><div key={String(l)} className="rounded-xl border bg-white p-4"><p className="text-sm text-slate-500">{l}</p><strong>{String(l).includes("Total")?money(Number(v)):v}</strong></div>)}</div><div className="mt-4 overflow-x-auto rounded-xl border bg-white">{report.detalle.length===0?<p className="p-5">Sin resultados para el periodo.</p>:<table className="min-w-full text-sm"><thead><tr>{["Unidad","Usuario","Concepto","Vence","Pagado","Pendiente","Estado"].map(x=><th key={x} className="p-3 text-left">{x}</th>)}</tr></thead><tbody>{report.detalle.map((r,i)=><tr key={`${r.id_casa}-${i}`} className="border-t"><td className="p-3">{r.unidad}</td><td>{r.usuario}</td><td>{r.concepto}</td><td>{r.fecha_limite}</td><td>{money(r.pagado)}</td><td>{money(r.pendiente)}</td><td>{r.estado}</td></tr>)}</tbody></table>}</div></>:null}
  </AdminLayout>;
}
