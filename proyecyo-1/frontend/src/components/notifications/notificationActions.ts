import type { NotificationRecord } from "@/types/notifications";

export function notificationAction(notification: NotificationRecord, role: "residente" | "inquilino") {
  if (notification.accion_codigo === "ESTADO_CUENTA") {
    return { to: `/${role}/estado-cuenta`, label: "Ver estado de cuenta" };
  }
  if (notification.accion_codigo === "COMPROBANTE_PAGO"
    && Number.isSafeInteger(notification.id_pago) && Number(notification.id_pago) > 0) {
    return { to: `/${role}/pagos/${notification.id_pago}/comprobante`, label: "Ver comprobante" };
  }
  return null;
}
