# HU13 - Exportación
`GET /admin/reportes/exportar?reporte=&formato=` requiere administrador. Admite accesos, reservas,
morosos y sanciones. PDFKit produce PDF real y ExcelJS un XLSX real, con Content-Type y
Content-Disposition correctos. Las celdas de texto que comienzan con `=`, `+`, `-` o `@`, incluso
tras espacios, se neutralizan. La pantalla `/admin/reportes` evita doble envío, muestra errores
y descarga el archivo.

HU10 amplía la exportación: fechas inclusivas, horario de Guatemala, formatos uniformes,
filtros de accesos y hasta 10,000 registros. Al superar el límite se pide reducir el período;
no se entrega un archivo truncado. Ver [HU10](hu10-reportes-pdf.md).
