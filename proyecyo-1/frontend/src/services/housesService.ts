import { apiRequest } from "@/services/api";
import type { HouseDetail, HouseFormValues, HouseList, HouseSelectionRole, HouseStatus } from "@/types/houses";

export interface HouseListFilters {
  q?: string;
  estado?: HouseStatus | "";
  seleccion?: HouseSelectionRole;
  id_usuario?: number | null;
}

export function getHousesRequest(filters: HouseListFilters = {}) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.estado) params.set("estado", filters.estado);
  if (filters.seleccion) params.set("seleccion", filters.seleccion);
  if (filters.id_usuario) params.set("id_usuario", String(filters.id_usuario));
  const query = params.toString();
  return apiRequest<HouseList>(`/admin/viviendas${query ? `?${query}` : ""}`);
}

export function getHouseDetailRequest(id: number) {
  return apiRequest<HouseDetail>(`/admin/viviendas/${id}`);
}

export function createHouseRequest(values: HouseFormValues) {
  return apiRequest<HouseDetail>("/admin/viviendas", { method: "POST", body: values });
}

export function updateHouseRequest(id: number, values: HouseFormValues) {
  return apiRequest<HouseDetail>(`/admin/viviendas/${id}`, { method: "PUT", body: values });
}

export function setHouseActiveRequest(id: number, activo: boolean) {
  return apiRequest<HouseDetail>(`/admin/viviendas/${id}/activo`, { method: "PATCH", body: { activo } });
}
