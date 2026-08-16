# HU9 — Recordatorio de pago del inquilino

## Objetivo

Notificar automáticamente al inquilino autorizado de una unidad cuando una cuota esté próxima a
vencer o vencida, mostrar la alerta real en su panel y registrar cada envío.

## Subtareas cubiertas

- **SCRUM-468:** el programador automático genera notificaciones para inquilinos autorizados.
- **SCRUM-469:** utiliza las fechas límite de `CUOTA` y la anticipación configurable.
- **SCRUM-470:** el panel del inquilino muestra las notificaciones pendientes reales.
- **SCRUM-471:** cada envío queda relacionado con usuario, cuota y notificación.
- **SCRUM-472:** integración mediante los endpoints protegidos de `/notificaciones`.
- **SCRUM-473:** pruebas unitarias de las reglas y plantillas compartidas.
- **SCRUM-474:** pruebas funcionales de consulta y actualización de notificaciones.
- **SCRUM-475:** documentación funcional y técnica.

## Comportamiento

El propietario y cada inquilino autorizado y activo asociado a la casa reciben su propia
notificación. La clave única `(id_cuota, id_usuario, tipo, fecha_envio)` evita duplicados para un
mismo destinatario sin impedir que los demás usuarios de la unidad sean avisados.

El inquilino puede marcar la alerta como leída desde su panel. Las notificaciones leídas dejan de
aparecer en la sección de alertas pendientes.
