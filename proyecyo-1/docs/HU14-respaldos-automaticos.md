# HU14 — Respaldos automáticos

El administrador configura frecuencia controlada (`DIARIO`, `SEMANAL` o `MENSUAL`), hora, activación y retención desde Configuración. La API ofrece `GET/PUT /admin/respaldos/configuracion`, `GET /admin/respaldos`, `POST /admin/respaldos/ejecutar` y `GET /admin/respaldos/:id/descargar`; todas requieren cabeceras de sesión administrativa.

El programador se inicia una sola vez con el servidor, evita ejecuciones simultáneas y registra inicio, final, tamaño, duración y error seguro en `RESPALDO_AUTOMATICO`. Los archivos se guardan fuera del árbol de la aplicación por defecto (directorio temporal del sistema, configurable con `BACKUP_DIR`), con nombres generados y resolución que bloquea traversal. La retención elimina únicamente archivos asociados a registros conocidos.

El contenido es SQL de datos reales, sin credenciales ni rutas internas, limitado a las tablas autorizadas por HU5 y a 2 MB. Usa sentencias `INSERT ... ON DUPLICATE KEY`, por lo que puede validarse y restaurarse mediante la pantalla segura de HU5. Las pruebas no conectan a producción ni ejecutan utilidades externas.

Prueba manual: use una base local, configure el respaldo, pulse “Ejecutar”, compruebe el historial y descargue el `.sql`; luego selecciónelo en Restauración y ejecute primero “Validar”.
