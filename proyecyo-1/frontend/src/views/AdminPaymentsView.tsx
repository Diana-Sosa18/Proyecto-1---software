import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, CalendarClock, Receipt, Search, TriangleAlert } from "lucide-react";

import { AdminLayout } from "@/components/admin/AdminLayout";
import { Input } from "@/components/ui/input";
import { getAdminPaymentsRequest } from "@/services/paymentsService";
import type { AdminPaymentRecord, AdminPaymentStatus } from "@/types/payments";

type PaymentStatusFilter = AdminPaymentStatus | "TODOS";

const paymentStatusStyles: Record<AdminPaymentStatus, string> = {
  PAGADO: "bg-emerald-100 text-emerald-700",
  PENDIENTE: "bg-amber-100 text-amber-700",
  MOROSO: "bg-rose-100 text-rose-700",
};

const paymentStatusLabels: Record<AdminPaymentStatus, string> = {
  PAGADO: "Al dia",
  PENDIENTE: "Pendiente",
  MOROSO: "Moroso",
};

const currencyFormatter = new Intl.NumberFormat("es-GT", {
  style: "currency",
  currency: "GTQ",
});

function formatCurrency(amount: number) {
  return currencyFormatter.format(amount);
}

function formatDueDate(date: string | null) {
  if (!date) {
    return "Sin cuotas pendientes";
  }

  return new Intl.DateTimeFormat("es-GT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function AdminPaymentsView() {
  const [payments, setPayments] = useState<AdminPaymentRecord[]>([]);
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState<PaymentStatusFilter>("TODOS");
  const [date, setDate] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadData(options: { silent?: boolean } = {}) {
    const { silent = false } = options;

    try {
      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage("");
      const response = await getAdminPaymentsRequest({ search, estado, date });
      setPayments(response);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No fue posible cargar el listado de pagos.",
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [search, estado, date]);

  const paymentStats = useMemo(() => {
    const today = todayIso();

    return [
      {
        label: "Al dia",
        value: payments.filter((payment) => payment.estado === "PAGADO").length,
        icon: BadgeCheck,
        iconClassName: "bg-emerald-50 text-emerald-600",
        valueClassName: "text-slate-950",
      },
      {
        label: "Pendientes",
        value: payments.filter((payment) => payment.estado === "PENDIENTE").length,
        icon: Receipt,
        iconClassName: "bg-amber-50 text-amber-600",
        valueClassName: "text-amber-600",
      },
      {
        label: "Morosos",
        value: payments.filter((payment) => payment.estado === "MOROSO").length,
        icon: TriangleAlert,
        iconClassName: "bg-rose-50 text-rose-600",
        valueClassName: "text-rose-600",
      },
      {
        label: "Vencen hoy",
        value: payments.filter((payment) => payment.fecha_limite === today).length,
        icon: CalendarClock,
        iconClassName: "bg-blue-50 text-blue-600",
        valueClassName: "text-blue-600",
      },
    ];
  }, [payments]);

  return (
    <AdminLayout title="Pagos" subtitle="Listado de residentes con cuotas pendientes y su estado de mora.">
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

      <section className="mt-5 grid gap-3 lg:grid-cols-3">
        <div className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por residente o unidad..."
            className="h-11 rounded-2xl border-slate-100 bg-white pl-11"
          />
        </div>
        <Input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="h-11 rounded-2xl border-slate-100 bg-white"
        />
      </section>

      <section className="mt-3">
        <select
          value={estado}
          onChange={(event) => setEstado(event.target.value as PaymentStatusFilter)}
          className="h-11 rounded-2xl border border-slate-100 bg-white px-4 text-sm outline-none focus:border-blue-300"
        >
          <option value="TODOS">Todos los estados</option>
          <option value="MOROSO">Morosos</option>
          <option value="PENDIENTE">Pendientes</option>
          <option value="PAGADO">Al dia</option>
        </select>
      </section>

      {errorMessage ? (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <section className="mt-5 rounded-[20px] border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-[1.24rem] font-semibold text-slate-950">Estado de cuenta por residente</h2>
          <p className="mt-1 text-[0.82rem] text-slate-500">
            {isRefreshing ? "Actualizando..." : "Monto pendiente y fecha limite mas proxima por unidad."}
          </p>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-6 text-center text-sm text-slate-500">Cargando pagos...</div>
          ) : payments.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              No hay residentes que coincidan con los filtros.
            </div>
          ) : (
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.1em] text-slate-500">
                  <th className="px-5 py-3 font-semibold">Unidad</th>
                  <th className="px-5 py-3 font-semibold">Residente</th>
                  <th className="px-5 py-3 font-semibold">Monto pendiente</th>
                  <th className="px-5 py-3 font-semibold">Recargo</th>
                  <th className="px-5 py-3 font-semibold">Total</th>
                  <th className="px-5 py-3 font-semibold">Vencimiento</th>
                  <th className="px-5 py-3 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id_casa} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-5 py-3 text-sm text-slate-700">{payment.unidad}</td>
                    <td className="px-5 py-3 text-sm text-slate-950">{payment.propietario_nombre}</td>
                    <td className="px-5 py-3 text-sm text-slate-500">
                      {formatCurrency(payment.monto_pendiente)}
                    </td>
                    <td className="px-5 py-3 text-sm">{formatCurrency(payment.recargo_aplicado)}</td>
                    <td className="px-5 py-3 text-sm font-semibold">{formatCurrency(payment.total_pendiente)}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-500">{formatDueDate(payment.fecha_limite)}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[0.7rem] font-medium ${paymentStatusStyles[payment.estado]}`}
                      >
                        {paymentStatusLabels[payment.estado]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </AdminLayout>
  );
}
