import { apiRequest } from "@/services/api";
import type {
  AdminProviderFilters,
  AdminProviderHistoryRecord,
  AdminProviderRecord,
  TenantProvider,
  TenantProviderFilters,
  TenantProviderHistoryFilters,
  TenantProviderHistoryRecord,
} from "@/types/providers";

function buildQuery(filters: Record<string, string | number | undefined | null>) {
  const query = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    const normalized = String(value).trim();

    if (!normalized || normalized === "TODOS") {
      return;
    }

    query.set(key, normalized);
  });

  return query.toString();
}

export function getTenantProvidersRequest(filters: TenantProviderFilters = {}) {
  const query = buildQuery(filters);
  const url = query ? `/inquilino/proveedores?${query}` : "/inquilino/proveedores";
  return apiRequest<TenantProvider[]>(url);
}

export function getTenantProviderHistoryRequest(filters: TenantProviderHistoryFilters = {}) {
  const query = buildQuery(filters);
  const url = query
    ? `/inquilino/proveedores/historial?${query}`
    : "/inquilino/proveedores/historial";
  return apiRequest<TenantProviderHistoryRecord[]>(url);
}

export function createTenantProviderRequest(payload: {
  nombre: string;
  tipo_servicio: string;
  descripcion?: string;
}) {
  return apiRequest<TenantProvider>("/inquilino/proveedores", {
    method: "POST",
    body: payload,
  });
}

export function updateTenantProviderRequest(serviceId: number, activo: boolean) {
  return apiRequest<TenantProvider>(`/inquilino/proveedores/${serviceId}`, {
    method: "PATCH",
    body: { activo },
  });
}

export function getAdminProvidersRequest(filters: AdminProviderFilters = {}) {
  const query = buildQuery(filters);
  const url = query ? `/admin/proveedores?${query}` : "/admin/proveedores";
  return apiRequest<AdminProviderRecord[]>(url);
}

export function getAdminProviderHistoryRequest(filters: AdminProviderFilters = {}) {
  const query = buildQuery(filters);
  const url = query ? `/admin/proveedores/historial?${query}` : "/admin/proveedores/historial";
  return apiRequest<AdminProviderHistoryRecord[]>(url);
}

export function updateAdminProviderRequest(payload: {
  id_servicio: number;
  id_casa: number;
  estado: "VALIDADO" | "PENDIENTE";
  activo: boolean;
}) {
  return apiRequest<AdminProviderRecord>(`/admin/proveedores/${payload.id_servicio}`, {
    method: "PATCH",
    body: payload,
  });
}
