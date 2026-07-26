import { apiRequest } from "@/services/api";

export type DemoRequestPayload = {
  nombre: string;
  correo: string;
  telefono: string;
  residencial: string;
  cantidadViviendas: number;
  mensaje: string;
  aceptaContacto: boolean;
  sitioWeb?: string;
};

export type DemoRequest = Omit<DemoRequestPayload, "aceptaContacto" | "sitioWeb"> & {
  id: number;
  estado: "NUEVA" | "CONTACTADA" | "DESCARTADA" | "CONVERTIDA";
  fechaCreacion: string;
  fechaActualizacion: string;
};

export const createDemoRequest = (payload: DemoRequestPayload) =>
  apiRequest<{ id: number; message: string }>("/public/solicitudes-demo", { method: "POST", body: payload });

export const listDemoRequests = (query: string) =>
  apiRequest<{ items: DemoRequest[]; page: number; limit: number; total: number }>(`/admin/solicitudes-demo?${query}`);

export const getDemoRequest = (id: number) => apiRequest<DemoRequest>(`/admin/solicitudes-demo/${id}`);

export const updateDemoRequestStatus = (id: number, estado: DemoRequest["estado"]) =>
  apiRequest<DemoRequest>(`/admin/solicitudes-demo/${id}/estado`, { method: "PATCH", body: { estado } });
