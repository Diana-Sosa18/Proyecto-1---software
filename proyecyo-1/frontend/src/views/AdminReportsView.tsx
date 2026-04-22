import { BarChart3, ClipboardList, Download, FileCheck2, ShieldAlert } from "lucide-react";

import { AdminLayout } from "@/components/admin/AdminLayout";

const reportStats = [
  {
    label: "Incidencias abiertas",
    value: "12",
    icon: ShieldAlert,
    iconClassName: "bg-rose-50 text-rose-600",
    valueClassName: "text-rose-600",
  },
  {
    label: "Resueltos",
    value: "34",
    icon: FileCheck2,
    iconClassName: "bg-emerald-50 text-emerald-600",
    valueClassName: "text-emerald-600",
  },
  {
    label: "Exportaciones",
    value: "9",
    icon: Download,
    iconClassName: "bg-blue-50 text-blue-600",
    valueClassName: "text-blue-600",
  },
  {
    label: "Indicadores",
    value: "94%",
    icon: BarChart3,
    iconClassName: "bg-violet-50 text-violet-600",
    valueClassName: "text-slate-950",
  },
];

export function AdminReportsView() {
  return (
    <AdminLayout title="Reportes" subtitle="Panel visual para seguimiento y generacion de reportes.">
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {reportStats.map(({ label, value, icon: Icon, iconClassName, valueClassName }) => (
          <article
            key={label}
            className="rounded-[24px] border border-slate-200 bg-white px-7 py-7 shadow-[0_10px_30px_rgba(15,23,42,0.05)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[1.02rem] text-slate-500">{label}</p>
                <p className={`mt-4 text-5xl font-medium tracking-tight ${valueClassName}`}>{value}</p>
              </div>
              <div className={`rounded-2xl p-4 ${iconClassName}`}>
                <Icon className="size-7" />
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-3">
        {[
          {
            title: "Accesos diarios",
            text: "Bloque para reportes operativos con tabla, resumen y exportacion visual.",
          },
          {
            title: "Cobranza mensual",
            text: "Espacio preparado para historicos, comparativas y filtros del modulo.",
          },
          {
            title: "Incidencias y tickets",
            text: "Vista consistente con el layout base para consolidar hallazgos y seguimiento.",
          },
        ].map((card) => (
          <article
            key={card.title}
            className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-[0_10px_30px_rgba(15,23,42,0.05)]"
          >
            <div className="flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <ClipboardList className="size-7" />
            </div>
            <h2 className="mt-6 text-[1.7rem] font-semibold text-slate-950">{card.title}</h2>
            <p className="mt-3 text-base leading-7 text-slate-500">{card.text}</p>
          </article>
        ))}
      </section>
    </AdminLayout>
  );
}
