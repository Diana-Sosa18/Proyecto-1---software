# HU16 - Recordatorios de reservas

El scheduler horario existente de recordatorios ahora consulta también reservas que comienzan en los próximos 60 minutos. Solo considera reservas confirmadas futuras, amenidades activas y usuarios activos.

Cada aviso se persiste como `RECORDATORIO_RESERVA` en `NOTIFICACION`. `RECORDATORIO_RESERVA` mantiene una clave única por usuario, amenidad, fecha y hora de inicio para impedir duplicados incluso entre procesos concurrentes.
