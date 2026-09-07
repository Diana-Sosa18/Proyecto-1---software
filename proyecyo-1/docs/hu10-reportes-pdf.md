# HU10 - Mejorar reportes y documentos PDF

## Auditoría (HU10.1 / SCRUM-626)
- Reportes existentes: accesos, reservas, morosos y sanciones; PDFKit y ExcelJS.
- Se aceptaban fechas imposibles; se consultaban como máximo 500 filas sin advertencia.
- Fechas MySQL podían convertirse a objetos Date y mostrarse con la zona del servidor; la generación y el nombre del archivo usaban UTC.
- Accesos y reservas omitían horas. Morosos incluía cuotas vencidas ya pagadas y no descontaba abonos.
- PDF sin columnas uniformes, total de registros, mensaje vacío ni numeración.
- El botón de accesos ejecutaba window.print() en lugar de exportar un documento.

## Implementación
- **HU10.2 / SCRUM-627:** fechas reales, límites inclusivos y rangos abiertos. La exportación de accesos reutiliza la consulta de la pantalla para búsqueda, unidad, placa, tipo y estado. El botón exporta el día actual de Guatemala. Reportes permite consultar el historial por período.
- **HU10.3 / SCRUM-628:** una sola fecha de generación por descarga, en America/Guatemala, también para el nombre del archivo y para determinar cuotas vencidas. DATE y TIME se formatean en SQL conservando el calendario y horario almacenados; se presentan como DD/MM/YYYY y horario de 24 horas. Los DATETIME de sanciones se consideran hora local, conforme al esquema existente.
- **HU10.4 / SCRUM-629:** PDF A4 horizontal con márgenes, identidad NexusResidencial, título, autor, fecha, zona, filtros, total, columnas estables, filas alternas y pie Página X de Y. Encabezados repetidos; textos extensos continúan en otra página sin recorte. Exportaciones vacías conservan encabezados y muestran un mensaje. Excel comparte columnas y metadatos, ajusta texto, congela encabezados y mantiene montos numéricos con dos decimales.
- **HU10.5 / SCRUM-630:** descargas reales con MIME y nombre de archivo del servidor; error si la respuesta es vacía o tiene formato incorrecto. El servidor requiere administrador. Fórmulas neutralizadas solo en celdas de texto de Excel. Hasta 10,000 registros; al excederlos se rechaza la exportación y se solicita reducir el período, sin entregar datos truncados.
- **HU10.6 / SCRUM-631:** pruebas de validación, consulta parametrizada, zona horaria, más de 500 registros, límite, Excel leído nuevamente, PDF multipágina, autorización, cabeceras, filtros enviados y errores de descarga.

## Semántica de morosos
Una fila por cuota vencida con saldo positivo: monto menos la suma de pagos. El período se aplica a la fecha de vencimiento y el saldo corresponde al momento de la consulta; no es una reconstrucción histórica de la deuda. Se usa la fecha local de Guatemala como corte de vencimiento.

## Validación
- Backend: `npm test`; pruebas específicas: `node --test test/reportExport.test.js`.
- Frontend: `npm run test:run -- src/services/reportExportService.test.ts src/views/AdminReportsView.test.tsx` y `npm run build`.
- Revisión visual: muestras de los cuatro reportes, documento vacío y sanciones con un texto que ocupa varias páginas; renderizado y extracción de texto con pypdf/pypdfium2.
- Las pruebas automatizadas simulan MySQL; para aceptación en un entorno con datos reales, comparar filas y saldos contra la pantalla y la base de datos.

## Prueba manual de aceptación
1. En Reportes, exportar PDF y Excel de cada reporte con ambas fechas, una fecha y sin fechas.
2. Comprobar que se incluyen el primer y último día y que la cantidad de filas coincide con la consulta.
3. En Control de Accesos, combinar búsqueda, unidad, placa, tipo y estado; exportar y comparar con los accesos del día.
4. Revisar horas de ingreso/inicio y salida, horarios de reservas y hora de generación de sanciones.
5. Probar una cuota vencida sin pagos, una parcialmente pagada y otra liquidada: solo las dos primeras deben aparecer, con su saldo restante.
6. Exportar sin coincidencias y con muchas filas; revisar encabezados, numeración, acentos y texto largo.
7. Intentar fechas inválidas por API y un rango invertido; debe devolver 400. Sin rol administrador debe devolver 403.
