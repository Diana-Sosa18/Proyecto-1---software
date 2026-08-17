# HU4, HU5, HU8 y HU9

Los residentes e inquilinos pueden descargar comprobantes PDF únicamente de pagos asociados a su unidad mediante `GET /residente/pagos/:paymentId/comprobante` y `GET /inquilino/pagos/:paymentId/comprobante`. Las consultas parametrizadas verifican rol, usuario y relación vigente antes de generar el documento; las respuestas no se almacenan en caché.

El servicio de recordatorios revisa al iniciar y cada hora las cuotas impagas dentro del rango configurado. Notifica a propietarios activos y a inquilinos activos/autorizados. La clave única `(id_cuota, id_usuario, tipo, fecha_envio)` evita duplicados sin impedir que los dos titulares válidos reciban el aviso. Las notificaciones se consultan y marcan como leídas con las rutas existentes.

No se utilizan proveedores externos ni datos bancarios.
