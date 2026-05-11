import { apiRequest } from "@/services/api";
import type { TenantProvider } from "@/types/providers";

export function getTenantProvidersRequest() {
  return apiRequest<TenantProvider[]>("/inquilino/proveedores");
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
