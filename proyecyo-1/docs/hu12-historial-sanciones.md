# HU12 – Historial completo
Extiende HU3 sin duplicar tablas. `GET /admin/sanciones-historial` admite paginación, fechas,
residente, estado y regla; `GET /admin/sanciones-historial/:id` devuelve detalle y eventos.
Ambos requieren administrador. La pantalla `/admin/sanciones/historial-completo` controla carga,
vacío, error, filtros, paginación y detalle de solo lectura.
