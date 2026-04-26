import { CalendarClock, DollarSign, Receipt, TriangleAlert } from "lucide-react";

import { AdminLayout } from "@/components/admin/AdminLayout";

const paymentStats = [
  {
    label: "Cobrado este mes",
    value: "$48,200",
    icon: DollarSign,
    iconClassName: "bg-emerald-50 text-emerald-600",
    valueClassName: "text-slate-950",
  },
  {
    label: "Pendientes",
    value: "14",
    icon: Receipt,
    iconClassName: "bg-amber-50 text-amber-600",
    valueClassName: "text-amber-600",
  },
  {
    label: "Morosos",
    value: "8",
    icon: TriangleAlert,
    iconClassName: "bg-rose-50 text-rose-600",
    valueClassName: "text-rose-600",
  },
  {
    label: "Vencen hoy",
    value: "5",
    icon: CalendarClock,
    iconClassName: "bg-blue-50 text-blue-600",
    valueClassName: "text-blue-600",
  },
];

const payments = [
  ["A-101", "Juan Perez", "$1,200", "22 abril", "Pagado"],
  ["B-205", "Maria Gonzales", "$1,200", "22 abril", "Pendiente"],
  ["C-303", "Servicio de limpieza", "$850", "23 abril", "Pendiente"],
  ["A-102", "Ana Martinez", "$1,200", "24 abril", "Pagado"],
];

const paymentStatusStyles: Record<string, string> = {
  Pagado: "bg-emerald-100 text-emerald-700",
  Pendiente: "bg-amber-100 text-amber-700",
};

export function AdminPaymentsView() {
  return (
    <AdminLayout title="Pagos" subtitle="Vista general de cuotas, cobranzas y seguimiento visual.">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {paymentStats.map(({ label, value, icon: Icon, iconClassName, valueClassName }) => (
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

      <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <article className="rounded-[20px] border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-[1.24rem] font-semibold text-slate-950">Pagos recientes</h2>
            <p className="mt-1 text-[0.82rem] text-slate-500">
              Diseno base para visualizar cuotas y estado de cobro.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.1em] text-slate-500">
                  <th className="px-5 py-3 font-semibold">Unidad</th>
                  <th className="px-5 py-3 font-semibold">Nombre</th>
                  <th className="px-5 py-3 font-semibold">Monto</th>
                  <th className="px-5 py-3 font-semibold">Vencimiento</th>
                  <th className="px-5 py-3 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(([unit, name, amount, dueDate, status]) => (
                  <tr key={`${unit}-${name}`} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-5 py-3 text-sm text-slate-700">{unit}</td>
                    <td className="px-5 py-3 text-sm text-slate-950">{name}</td>
                    <td className="px-5 py-3 text-sm text-slate-500">{amount}</td>
                    <td className="px-5 py-3 text-sm text-slate-500">{dueDate}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[0.7rem] font-medium ${paymentStatusStyles[status]}`}
                      >
                        {status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <h2 className="text-[1.24rem] font-semibold text-slate-950">Resumen visual</h2>
          <div className="mt-4 grid gap-2.5">
            {[
              "Distribucion clara entre pagos al dia, pendientes y morosos.",
              "Tarjetas grandes para indicadores clave del mes.",
              "Tabla principal alineada al mismo lenguaje visual del dashboard.",
            ].map((item) => (
              <div key={item} className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-[0.82rem] text-slate-600">
                {item}
              </div>
            ))}
          </div>
        </article>
      </section>
    </AdminLayout>
  );
}
