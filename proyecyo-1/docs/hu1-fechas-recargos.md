# HU1 – Fechas límite y recargos
Administradores usan `/admin/configuracion` y los endpoints `GET/PUT /admin/configuracion-financiera`
y `POST /admin/recargos/aplicar`. La regla se almacena en `CONFIGURACION`; cada cuota recibe como
máximo un registro en `RECARGO_APLICADO`, garantizando idempotencia. Se validan día 1–28, tipo,
porcentaje 0–100, monto no negativo, gracia 0–90 y vigencia. HU2 suma y muestra los recargos.
Para probar, cree una cuota vencida en una base local, aplique dos veces y confirme un solo recargo.
