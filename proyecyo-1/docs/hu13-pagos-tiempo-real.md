# HU13 - Pagos recientes para administración

Se usa polling cada 30 segundos porque es el mecanismo ya empleado por los paneles y estados de cuenta de NexusResidencial. Evita incorporar infraestructura WebSocket innecesaria. El endpoint devuelve hasta 100 transacciones simuladas, más recientes primero, con filtros combinables y parametrizados.
