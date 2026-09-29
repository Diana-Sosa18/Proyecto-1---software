export interface ActiveSession {
  id_sesion: string;
  dispositivo: string;
  direccion_ip: string | null;
  creada_en: string;
  ultima_actividad_en: string;
  expira_en: string;
  actual: boolean;
}

export interface CloseSessionResponse {
  id_sesion: string;
  cerrada: boolean;
  actual: boolean;
}
