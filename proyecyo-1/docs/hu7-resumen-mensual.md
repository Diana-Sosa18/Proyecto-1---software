# HU7 – Resumen mensual
`GET /residente/resumen-mensual?month=&year=` usa únicamente el usuario autenticado y calcula
límites `[inicio, primer día siguiente)`, incluyendo diciembre/enero y años bisiestos. Consulta
ACCESO, REGISTRO_ACCESO, RESERVA y AMENIDAD; no duplica datos. La vista
`/residente/resumen-mensual` incluye período, tarjetas, actividad reciente, carga, error y vacío.
