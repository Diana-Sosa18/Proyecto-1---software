import type { AccountQuotaStatus } from "@/types/account";

// El estado de la cuota lo calcula SOLO el backend (services/quotaStatus.js). Aqui
// unicamente se presenta, igual en Mis pagos, Cargos y pagos y la cuenta del inquilino.
export const quotaStatusLabels: Record<AccountQuotaStatus, string> = {
  PAGADA: "Pagada",
  PENDIENTE: "Pendiente",
  VENCIDA: "Vencida",
};

export const quotaStatusStyles: Record<AccountQuotaStatus, string> = {
  PAGADA: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  PENDIENTE: "bg-amber-100 text-amber-700 ring-amber-200",
  VENCIDA: "bg-rose-100 text-rose-700 ring-rose-200",
};
