# HU10 Historial financiero del inquilino

La ruta protegida `GET /inquilino/historial-financiero?desde=YYYY-MM-DD&hasta=YYYY-MM-DD` reutiliza el estado de cuenta de HU7 y limita las consultas a la unidad autorizada del inquilino autenticado. Incluye alquiler, cuotas adicionales, saldos, estados, pagos, recargos y periodo aplicado. La interfaz reutiliza `/inquilino/estado-cuenta` y añade filtros y estados vacíos.
