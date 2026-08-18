import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  RefreshCw,
  WalletCards,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getResidentAccountStatementRequest, payResidentObligationRequest } from "@/services/accountService";
import type { SimulatedPaymentResult } from "@/services/accountService";
import { downloadResidentPaymentReceiptRequest } from "@/services/financialDetailService";
import { savePaymentReceipt } from "@/services/paymentReceiptService";
import type { AccountQuota, AccountQuotaStatus, AccountStatement } from "@/types/account";

type AccountFilter = "TODAS" | AccountQuotaStatus;

const filterLabels: Record<AccountFilter, string> = {
  TODAS: "Todas",
  PENDIENTE: "Pendientes",
  VENCIDA: "Vencidas",
  PAGADA: "Pagadas",
};

const statusLabels: Record<AccountQuotaStatus, string> = {
  PAGADA: "Pagada",
  PENDIENTE: "Pendiente",
  VENCIDA: "Vencida",
};

const statusStyles: Record<AccountQuotaStatus, string> = {
  PAGADA: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  PENDIENTE: "bg-amber-100 text-amber-700 ring-amber-200",
  VENCIDA: "bg-rose-100 text-rose-700 ring-rose-200",
};

const emptyStatement: AccountStatement = {
  resumen: {
    total_cuotas: 0,
    cuotas_pagadas: 0,
    cuotas_pendientes: 0,
    cuotas_vencidas: 0,
    saldo_pendiente: 0,
    total_pagado: 0,
    proximo_vencimiento: null,
    actualizado_en: "",
  },
  cuotas: [],
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-GT", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(`${value}T00:00:00`));
}

function formatUpdatedAt(value: string) {
  if (!value) {
    return "Sin actualizar";
  }

  return new Intl.DateTimeFormat("es-GT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getProgress(quota: AccountQuota) {
  if (quota.monto <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((quota.monto_pagado / quota.monto) * 100));
}

export function ResidenteAccountView() {
  const navigate = useNavigate();
  const [statement, setStatement] = useState<AccountStatement>(emptyStatement);
  const [selectedFilter, setSelectedFilter] = useState<AccountFilter>("TODAS");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [payingQuotaId, setPayingQuotaId] = useState<number | null>(null);
  const [paymentResult, setPaymentResult] = useState<SimulatedPaymentResult | null>(null);

  async function payQuota(quota: AccountQuota) {
    const confirmed = window.confirm(
      `Pago simulado para fines académicos.\n\n${quota.servicio}\nMonto base: ${formatCurrency(quota.monto_base)}\nRecargos: ${formatCurrency(quota.recargo)}\nTotal: ${formatCurrency(quota.saldo_pendiente)}\n\n¿Confirmar pago?`,
    );
    if (!confirmed) return;
    try {
      setPayingQuotaId(quota.id_cuota);
      setErrorMessage("");
      const result = await payResidentObligationRequest(quota.id_cuota);
      setPaymentResult(result);
      await loadAccount({ silent: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No fue posible registrar el pago simulado.");
    } finally { setPayingQuotaId(null); }
  }

  async function downloadReceipt() {
    if (!paymentResult) return;
    try {
      const blob = await downloadResidentPaymentReceiptRequest(paymentResult.id_pago);
      savePaymentReceipt(blob, paymentResult.numero_comprobante);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No fue posible descargar el comprobante.");
    }
  }

  async function loadAccount({ silent = false } = {}) {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const response = await getResidentAccountStatementRequest();
      setStatement(response);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No fue posible cargar el estado de cuenta.",
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    void loadAccount();

    const intervalId = window.setInterval(() => {
      void loadAccount({ silent: true });
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const filteredQuotas = useMemo(() => {
    if (selectedFilter === "TODAS") {
      return statement.cuotas;
    }

    return statement.cuotas.filter((quota) => quota.estado === selectedFilter);
  }, [selectedFilter, statement.cuotas]);

  const summaryCards = [
    {
      label: "Saldo pendiente",
      value: formatCurrency(statement.resumen.saldo_pendiente),
      helper: `${statement.resumen.cuotas_pendientes + statement.resumen.cuotas_vencidas} cuotas por cubrir`,
      icon: WalletCards,
      iconClassName: "bg-sky-50 text-sky-700",
    },
    {
      label: "Cuotas pagadas",
      value: String(statement.resumen.cuotas_pagadas),
      helper: `${formatCurrency(statement.resumen.total_pagado)} registrado`,
      icon: CheckCircle2,
      iconClassName: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Cuotas vencidas",
      value: String(statement.resumen.cuotas_vencidas),
      helper:
        statement.resumen.cuotas_vencidas === 0
          ? "Sin mora activa"
          : "Requieren atencion",
      icon: AlertTriangle,
      iconClassName: "bg-rose-50 text-rose-700",
    },
    {
      label: "Proximo vencimiento",
      value: statement.resumen.proximo_vencimiento
        ? formatDate(statement.resumen.proximo_vencimiento)
        : "Al dia",
      helper: "Se refresca automaticamente",
      icon: CalendarClock,
      iconClassName: "bg-amber-50 text-amber-700",
    },
  ];

  return (
    <AppShell
      role="residente"
      title="Estado de Cuenta"
      subtitle="Resumen actualizado de cuotas, pagos aplicados y saldos pendientes."
    >
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-900">
            Ultima actualizacion: {formatUpdatedAt(statement.resumen.actualizado_en)}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            La informacion se consulta nuevamente cada 30 segundos mientras esta pantalla esta abierta.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => navigate("/residente")}>
            Volver
          </Button>
          <Button
            type="button"
            onClick={() => void loadAccount({ silent: true })}
            disabled={isRefreshing}
          >
            <RefreshCw className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Error en estado de cuenta</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <Alert className="border-sky-200 bg-sky-50 text-sky-800">
        <AlertTitle>Pago simulado para fines académicos.</AlertTitle>
        <AlertDescription>No se solicitan ni almacenan datos bancarios.</AlertDescription>
      </Alert>

      {paymentResult ? (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
          <AlertTitle>Pago realizado</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{paymentResult.concepto}: {formatCurrency(paymentResult.total)} · {paymentResult.numero_comprobante}</span>
            <Button type="button" variant="outline" onClick={() => void downloadReceipt()}>Descargar comprobante</Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {statement.resumen.cuotas_vencidas > 0 ? (
        <Alert className="border-rose-200 bg-rose-50 text-rose-800">
          <AlertTriangle className="size-5" />
          <AlertTitle>Cuotas vencidas pendientes</AlertTitle>
          <AlertDescription>
            Revisa los servicios marcados como vencidos para regularizar el saldo de tu unidad.
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(({ label, value, helper, icon: Icon, iconClassName }) => (
          <Card key={label} className="border-slate-200 bg-white/95">
            <CardContent className="flex min-h-[142px] items-start justify-between gap-4 p-5">
              <div>
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{isLoading ? "..." : value}</p>
                <p className="mt-2 text-sm text-slate-500">{helper}</p>
              </div>
              <div className={`rounded-lg p-3 ${iconClassName}`}>
                <Icon className="size-6" />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="border-slate-200 bg-white">
        <CardHeader className="gap-4 border-b border-slate-200">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Detalle de cuotas</CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                Consulta cuotas pagadas, pendientes y vencidas por servicio.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {(Object.keys(filterLabels) as AccountFilter[]).map((filter) => (
                <Button
                  key={filter}
                  type="button"
                  variant={selectedFilter === filter ? "default" : "outline"}
                  onClick={() => setSelectedFilter(filter)}
                  className="min-w-[94px]"
                >
                  {filterLabels[filter]}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredQuotas.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-slate-500">
              No hay cuotas para el filtro seleccionado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-[0.1em] text-slate-500">
                    <th className="px-5 py-3 font-semibold">Servicio</th>
                    <th className="px-5 py-3 font-semibold">Unidad</th>
                    <th className="px-5 py-3 font-semibold">Vencimiento</th>
                    <th className="px-5 py-3 font-semibold">Monto</th>
                    <th className="px-5 py-3 font-semibold">Pagado</th>
                    <th className="px-5 py-3 font-semibold">Saldo</th>
                    <th className="px-5 py-3 font-semibold">Estado</th>
                    <th className="px-5 py-3 font-semibold">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuotas.map((quota) => (
                    <tr key={quota.id_cuota} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-950">{quota.servicio}</p>
                        <p className="text-sm text-slate-500">{quota.tipo_servicio}</p>
                        <div className="mt-3 h-2 w-44 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-blue-700"
                            style={{ width: `${getProgress(quota)}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">{quota.casa_unidad}</td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {formatDate(quota.fecha_limite)}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {formatCurrency(quota.monto)}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {formatCurrency(quota.monto_pagado)}
                        <p className="mt-1 text-xs text-slate-400">
                          {quota.ultimo_pago ? `Ultimo pago ${formatDate(quota.ultimo_pago)}` : "Sin pagos"}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-slate-950">
                        {formatCurrency(quota.saldo_pendiente)}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusStyles[quota.estado]}`}
                        >
                          {statusLabels[quota.estado]}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {quota.estado !== "PAGADA" ? (
                          <Button type="button" disabled={payingQuotaId !== null} onClick={() => void payQuota(quota)}>
                            {payingQuotaId === quota.id_cuota ? "Procesando..." : "Pagar"}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
