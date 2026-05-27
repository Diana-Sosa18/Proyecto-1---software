export interface NotificationRecord {
  id_notificacion: number;
  id_usuario: number;
  id_acceso: number | null;
  tipo: "LLEGADA_VISITA" | string;
  titulo: string;
  mensaje: string;
  leido: boolean;
  creado_en: string;
  leido_en: string | null;
  visitante?: string | null;
  casa?: string | null;
  hora_llegada?: string | null;
}

export interface UnreadNotificationsResponse {
  unread: number;
}