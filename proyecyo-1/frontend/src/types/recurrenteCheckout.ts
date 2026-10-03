export interface RecurrenteCheckout {
  referencia_local: string;
  checkout_url: string;
}
export interface RecurrenteCheckoutStatus {
  referencia_local: string;
  estado: "PENDIENTE" | "CONFIRMADO" | "CUOTA_PAGADA" | "RECHAZADO" | "FALLIDO" | "CANCELADO" | "INCIERTO" | "NO_COMPLETADO";
  mensaje: string;
  accion: "NINGUNA" | "CONTINUAR" | "REINTENTAR";
}
