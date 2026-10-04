# Precisión de auditoría y recuperación controlada

## Causa comprobada

SHOW CREATE TABLE confirma que EVENTO_RECURRENTE.procesado_en y
REVISION_EVENTO_RECURRENTE.procesado_anterior son DATETIME(6). 006 permanece intacta.
El mysql2 instalado (3.20.0) devuelve Date por defecto en el pool de la aplicación.
Su parser binario divide los microsegundos entre 1000 al construir Date. Date solo
conserva milisegundos; al enlazarlo como parámetro, writeDate escribe
getMilliseconds()*1000. Así, .277859 se convirtió en .277000 antes de llegar al
destino SQL. No fue una conversión JSON, ISO ni DATE_FORMAT en ese archivado.

archiveReview usa INSERT ... SELECT y copia estado, error, contador y procesado_en
directamente desde la fila del inbox, bloqueada por la recuperación. Solo operador
e ID son parámetros JS. No cambia el tipo de fechas del pool ni otros consumidores.
Conserva NULL, milisegundos exactos y seis dígitos fraccionarios.

## Reparación histórica explícita

Después de procesar una revisión, el procesado_en actual ya contiene otra fecha.
No permite reconstruir los microsegundos del estado anterior. Es obligatorio
conservar una captura original de EVENTO_RECURRENTE tomada antes de la recuperación.
Sin esa evidencia exacta se rechaza la reparación; no se deduce el sufijo perdido.

repair-recurrente-review-precision.js requiere una base/puerto TEST explícitos,
un snapshot local elegido por el operador y su SHA-256 externo. Comprueba además
el hash del conjunto de filas originales. Vincula cada revisión a la generación
original mediante ID, ambiente, svix-id, hash del body, tipo, operación externa,
recepción, Sandbox, live_mode, checkout, estado, error y contador previos.
No contiene IDs ni fechas concretas de un incidente en el código de reparación.

Solo restaura un procesado_anterior que sea exactamente el timestamp original
truncado a milisegundos, con una pérdida entre 1 y 999 microsegundos. Verifica todo
el plan antes de modificar filas. Cambia únicamente ese campo de cada revisión.
La corrección y su registro se confirman juntos; un fallo revierte ambos.
Una reparación aplicada se reconoce por su registro y no vuelve a escribir.

007_recurrente_review_precision.sql agrega exclusivamente
REPARACION_REVISION_RECURRENTE con FK, UNIQUE, controles del patrón y fechas
DATETIME(6). No modifica 006, no altera columnas ni hace un backfill automático.
Guarda valor truncado/restaurado, operador, hashes del snapshot/fila y fecha.
Su aplicación es independiente de la reparación y es reaplicable.
La tabla se incluye en backup/restore y en las preparaciones del esquema.
El generador existente ya consulta con dateStrings:true; el round trip real
demuestra que conserva las fechas exactas de eventos, revisiones y reparaciones.

El CLI no hace llamadas a Recurrente, recuperaciones financieras ni replays.
Por defecto solo calcula el plan. --apply requiere autorización explícita.

```powershell
# Usar exclusivamente infraestructura TEST previamente autorizada.
node scripts/repair-recurrente-review-precision.js --prepare-schema
node scripts/repair-recurrente-review-precision.js --source="<snapshot-original-local>" --sha256=<digest-verificado>
node scripts/repair-recurrente-review-precision.js --source="<snapshot-original-local>" --sha256=<digest-verificado> --apply
```

## Dry-run de un éxito ya aplicado

El CLI de recuperación verifica captura original y digest; luego usa una
transacción READ ONLY para demostrar duplicate. Comprueba identidad, propiedad,
monto/moneda, Sandbox, checkout confirmado/paid, transacción, intent canónico,
payment compartido, fecha oficial y PAGO/origen existentes. Calcula el saldo con
la lógica común. No invoca el motor de recuperación ni archiva intentos/revisiones.
Los resultados review/requires-recovery no autorizan la ruta de duplicado.

## Pruebas

La suite precision usa únicamente una base desechable propiedad del runner.
Incluye .277859, .000001, .999999, .123456, .123000, .000000 y NULL;
revisiones múltiples, reparación, evidencia ajena, patrón incompatible,
idempotencia, rollback, 007 reaplicada, backup/restore y duplicate sin otro abono.
El resto de suites protege la base compartida y sus casos manuales por contenido.
No ejecutar pruebas automatizadas directamente sobre la base manual compartida.

## Resultado de la ejecución autorizada: 4 de octubre de 2026

Primero aprobaron 17 pruebas MySQL de precisión y 33 unitarias seleccionadas.
Las regresiones completas aprobaron 776 backend (93 node:test + 683 Jest),
310 MySQL de Fase 0/HU13–HU18/correlación, 12 funcionales y 167 frontend.
No hubo fallos ni omisiones. El build y git diff --check finalizaron con exit 0.
Las bases temporales y destinos de restauración propios se retiraron comprobando
propiedad; la base compartida permaneció intacta durante todas las pruebas.

007 se aplicó y reaplicó después de las pruebas. El plan de reparación detectó
solamente revisión 1/evento 1074; su timestamp pasó de .277000 a .277859 usando
la fila original de EVENTO_RECURRENTE conservada en el snapshot previo.
REPARACION_REVISION_RECURRENTE 1 conserva ambos valores y los hashes de evidencia.
No se utilizaron el nuevo procesado_en del evento ni una fecha inventada.

El dry-run de 1075 demostró duplicate/PAGO 658/saldo 0.00 y --apply devolvió
duplicate. Revisión 2 conservó exactamente 2026-10-04 11:50:01.512996.
Ambas revisiones conservan su antiguo estado REVISION/error/contador y resolución
PROCESADO. Los eventos 1072–1075 quedan PROCESADO; 1072–1074 no cambiaron durante
esta corrección. No se añadieron eventos, intentos ni transacciones financieras.

PAGO/PAGO_ORIGEN permanecieron en 600/600; REEMBOLSO_RECURRENTE en 33.
Cuota 1210 conserva exclusivamente PAGO 658 de Q5.00, fecha 2026-10-04,
RECURRENTE/sandbox y saldo Q0.00. Transacción 601 sigue CONFIRMADA/id_pago 658,
intent B canónico in_tysccwdi/payment pa_zwr6oxfm; el A in_xzke27ev sigue FALLIDA
en historial. Checkout 1139 sigue CONFIRMADO/paid. Los casos 171 y 998 permanecen
idénticos por contenido, incluidos sus timestamps. 005, 006 y .env no cambiaron.

El backend corregido quedó activo en 127.0.0.1:3100, conectado exclusivamente
al TEST 20378, sin schedulers ni preparación de datos al arrancar. Health HTTP 200;
frontend 127.0.0.1:5174 HTTP 200 y API efectiva 127.0.0.1:3100.
La comparación posterior al reinicio no detectó ninguna escritura financiera.
No se llamó a Recurrente ni se inició refund, pago, checkout, retry, replay o
conciliación. No se modificó la base normal ni se hicieron operaciones Git de
escritura. La recuperación quedó validada; la prueba de reembolso no se inició.
