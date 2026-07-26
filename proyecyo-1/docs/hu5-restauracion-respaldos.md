# HU5: restauración segura de respaldos

La pantalla **Administración > Configuración** permite seleccionar un archivo `.sql` de hasta
2 MB, validarlo y restaurarlo. Las rutas `GET /admin/restauraciones`,
`POST /admin/restauraciones/validar` y `POST /admin/restauraciones` requieren rol administrador.

El backend valida el nombre, tamaño, contenido y cada sentencia. Solo admite `INSERT`, `UPDATE`
y `DELETE` sobre tablas propias de la aplicación; rechaza DDL, selección de archivos, cambios de
base de datos y tablas ajenas. La ejecución usa una transacción y revierte todos los cambios ante
un error. Nunca debe probarse contra producción: use una base MySQL local creada con `sql/init.sql`.

Prueba manual: valide primero un respaldo de datos conocido, restaure y compruebe el historial.
Luego pruebe un archivo vacío, uno mayor de 2 MB y contenido como `DROP TABLE` o `SELECT ... INTO
OUTFILE`; todos deben ser rechazados sin modificar datos.
