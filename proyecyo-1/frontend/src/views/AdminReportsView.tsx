import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { downloadReport } from "@/services/reportExportService";

export function AdminReportsView() {
  const [report, setReport] = useState("accesos");
  const [format, setFormat] = useState("pdf");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    try {
      setBusy(true);
      setError("");
      if (desde && hasta && desde > hasta) throw new Error("La fecha inicial no puede ser posterior a la fecha final.");
      await downloadReport({ reporte: report, formato: format, desde, hasta });
    } catch (error) {
      setError(error instanceof Error ? error.message : "No fue posible exportar.");
    } finally {
      setBusy(false);
    }
  }
  return <AdminLayout title="Reportes" subtitle="Exporta datos reales respetando el reporte y período seleccionados.">
    <form className="rounded-xl border bg-white p-6" onSubmit={event => { event.preventDefault(); void download(); }}>
      <fieldset disabled={busy} className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">Reporte<select className="mt-1 w-full rounded-md border p-3" value={report} onChange={event => setReport(event.target.value)}>
          <option value="accesos">Accesos</option><option value="reservas">Reservas</option><option value="morosos">Morosos</option><option value="sanciones">Sanciones</option>
        </select></label>
        <label className="text-sm">Formato<select className="mt-1 w-full rounded-md border p-3" value={format} onChange={event => setFormat(event.target.value)}>
          <option value="pdf">PDF</option><option value="xlsx">Excel .xlsx</option>
        </select></label>
        <label className="text-sm">Desde<input className="mt-1 w-full rounded-md border p-2" type="date" max={hasta || undefined} value={desde} onChange={event => setDesde(event.target.value)} /></label>
        <label className="text-sm">Hasta<input className="mt-1 w-full rounded-md border p-2" type="date" min={desde || undefined} value={hasta} onChange={event => setHasta(event.target.value)} /></label>
      </fieldset>
      <p className="mt-4 text-sm text-slate-600">Fechas y horas de Guatemala. El período incluye ambos días; deje las fechas vacías para consultar todo el historial. Máximo 10,000 registros por exportación.</p>
      {report === "morosos" && <p className="mt-2 text-sm text-slate-600">El período filtra la fecha de vencimiento. Se muestran los saldos que siguen pendientes al generar el reporte.</p>}
      {error && <p role="alert" className="mt-3 text-rose-700">{error}</p>}
      <Button className="mt-5" type="submit" disabled={busy}>{busy ? "Generando..." : "Exportar"}</Button>
    </form>
  </AdminLayout>;
}
