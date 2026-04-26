import {
  AlertTriangle,
  CalendarDays,
  Clock3,
  KeyRound,
  UserRound,
  Wrench,
} from "lucide-react";

import { UsersManagement } from "@/components/admin/UsersManagement";
import { AdminLayout } from "@/components/admin/AdminLayout";

const dashboardCards = [
  {
    label: "Accesos Hoy",
    value: "142",
    icon: KeyRound,
    iconClassName: "bg-blue-50 text-blue-600",
    valueClassName: "text-slate-950",
  },
  {
    label: "Visitas Pendientes",
    value: "3",
    icon: Clock3,
    iconClassName: "bg-amber-50 text-amber-600",
    valueClassName: "text-amber-600",
  },
  {
    label: "Morosos",
    value: "8",
    icon: AlertTriangle,
    iconClassName: "bg-rose-50 text-rose-600",
    valueClassName: "text-rose-600",
  },
  {
    label: "Reservas Activas",
    value: "15",
    icon: CalendarDays,
    iconClassName: "bg-emerald-50 text-emerald-600",
    valueClassName: "text-emerald-600",
  },
];

const dashboardRows = [
  {
    hour: "16:45",
    type: "Residente",
    name: "Juan Perez",
    unit: "A-101",
    plate: "ABC-123",
    status: "Aprobado",
  },
  {
    hour: "16:42",
    type: "Visitante",
    name: "Maria Gonzalez",
    unit: "B-205",
    plate: "-",
    status: "Aprobado",
  },
  {
    hour: "16:38",
    type: "Proveedor",
    name: "Servicio de limpieza",
    unit: "C-303",
    plate: "XYZ-789",
    status: "Pendiente",
  },
  {
    hour: "16:35",
    type: "Residente",
    name: "Ana Martinez",
    unit: "A-102",
    plate: "DEF-456",
    status: "Aprobado",
  },
  {
    hour: "16:30",
    type: "Visitante",
    name: "Carlos Lopez",
    unit: "B-201",
    plate: "-",
    status: "Aprobado",
  },
  {
    hour: "16:28",
    type: "Residente",
    name: "Sofia Lopez",
    unit: "C-401",
    plate: "GHI-789",
    status: "Aprobado",
  },
];

const typeStyles: Record<string, string> = {
  Residente: "bg-blue-100 text-blue-700",
  Visitante: "bg-fuchsia-100 text-fuchsia-700",
  Proveedor: "bg-amber-100 text-amber-700",
};

const statusStyles: Record<string, string> = {
  Aprobado: "bg-emerald-100 text-emerald-700",
  Pendiente: "bg-amber-100 text-amber-700",
};

const hourlyAccesses = [
  { label: "00:00", value: 4 },
  { label: "02:00", value: 2 },
  { label: "04:00", value: 1 },
  { label: "06:00", value: 12 },
  { label: "08:00", value: 35 },
  { label: "10:00", value: 28 },
  { label: "12:00", value: 42 },
  { label: "14:00", value: 31 },
  { label: "16:00", value: 38 },
  { label: "18:00", value: 45 },
  { label: "20:00", value: 22 },
  { label: "22:00", value: 8 },
];

const chartLabels = ["60", "45", "30", "15", "0"];

export function AdminView() {
  return (
    <AdminLayout title="Dashboard" subtitle="Resumen general del residencial">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {dashboardCards.map(({ label, value, icon: Icon, iconClassName, valueClassName }) => (
          <article
            key={label}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.82rem] text-slate-500">{label}</p>
                <p className={`mt-2 text-3xl font-medium tracking-tight ${valueClassName}`}>{value}</p>
              </div>
              <div className={`rounded-xl p-2.5 ${iconClassName}`}>
                <Icon className="size-5" />
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.85fr)]">
        <article className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-[1.24rem] font-semibold text-slate-950">Accesos en Tiempo Real</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.1em] text-slate-500">
                  <th className="px-5 py-3 font-semibold">Hora</th>
                  <th className="px-5 py-3 font-semibold">Tipo</th>
                  <th className="px-5 py-3 font-semibold">Nombre</th>
                  <th className="px-5 py-3 font-semibold">Unidad</th>
                  <th className="px-5 py-3 font-semibold">Placa</th>
                  <th className="px-5 py-3 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {dashboardRows.map((row) => (
                  <tr key={`${row.hour}-${row.name}`} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-5 py-3 text-sm text-slate-900">{row.hour}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[0.7rem] font-medium ${typeStyles[row.type]}`}
                      >
                        {row.type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-950">{row.name}</td>
                    <td className="px-5 py-3 text-sm text-slate-500">{row.unit}</td>
                    <td className="px-5 py-3 text-sm text-slate-500">{row.plate}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[0.7rem] font-medium ${statusStyles[row.status]}`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <h2 className="text-[1.24rem] font-semibold text-slate-950">Accesos por Hora</h2>

          <div className="mt-4 flex gap-2.5">
            <div className="flex h-[250px] flex-col justify-between pb-6 text-[0.74rem] text-slate-500">
              {chartLabels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>

            <div className="relative flex-1">
              <div className="pointer-events-none absolute inset-0 rounded-[20px] border border-slate-200">
                {[0, 1, 2, 3].map((line) => (
                  <div
                    key={line}
                    className="absolute left-0 right-0 border-t border-dashed border-slate-300"
                    style={{ top: `${line * 25}%` }}
                  />
                ))}
              </div>

              <div className="relative flex h-[250px] items-end gap-2 px-2.5 pb-8 pt-4">
                {hourlyAccesses.map((item) => (
                  <div key={item.label} className="flex flex-1 flex-col items-center justify-end gap-3">
                    <div
                      className="w-full max-w-[20px] rounded-t-md bg-blue-500"
                      style={{ height: `${(item.value / 60) * 195}px` }}
                    />
                    <span className="text-[0.7rem] text-slate-500">
                      {Number(item.label.slice(0, 2)) % 4 === 2 ? item.label : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-3">
        {[
          {
            title: "Monitoreo de accesos",
            text: "Base visual preparada para conectar resumenes, tablas y estados del modulo.",
            icon: UserRound,
          },
          {
            title: "Mantenimiento",
            text: "Espacio secundario para avisos o recordatorios operativos del turno.",
            icon: Wrench,
          },
          {
            title: "Reservas",
            text: "El dashboard mantiene el mismo lenguaje visual para cada seccion administrativa.",
            icon: CalendarDays,
          },
        ].map(({ title, text, icon: Icon }) => (
          <article
            key={title}
            className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]"
          >
            <div className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Icon className="size-5" />
            </div>
            <h2 className="mt-4 text-[1.12rem] font-semibold text-slate-950">{title}</h2>
            <p className="mt-1.5 text-[0.82rem] leading-5 text-slate-500">{text}</p>
          </article>
        ))}
      </section>

      <section className="mt-5">
        <UsersManagement />
      </section>
    </AdminLayout>
  );
}
