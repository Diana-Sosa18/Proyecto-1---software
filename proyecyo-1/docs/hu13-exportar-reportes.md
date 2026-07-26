# HU13 – Exportación
`GET /admin/reportes/exportar?reporte=&formato=` requiere administrador. Admite accesos, reservas,
morosos y sanciones, con máximo 500 filas. PDFKit produce PDF real y ExcelJS un XLSX real, con
Content-Type/Disposition correctos. Celdas que comienzan con `=`, `+`, `-` o `@` se neutralizan.
La pantalla `/admin/reportes` evita doble envío, muestra errores y descarga el archivo.
