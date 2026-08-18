# HU15 Bloqueo por sanciones

Antes de insertar una reserva, el backend bloquea dentro de la misma transacción al residente o inquilino autorizado que tenga una sanción `PENDIENTE`. Las sanciones `PAGADA` y `ANULADA` no bloquean. Consultar amenidades y disponibilidad permanece permitido; el endpoint de creación responde 403 y el frontend muestra el mensaje existente del flujo de reserva.
