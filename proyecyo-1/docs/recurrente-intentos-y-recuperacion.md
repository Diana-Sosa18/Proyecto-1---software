# Intentos distintos con un payment compartido y recuperación de REVISION

## Evidencia y límite de la interpretación

Las cuatro entregas Sandbox observadas el 4 de octubre de 2026 contienen primero
un PaymentIntent fallido y después otro exitoso, con el mismo checkout y payment.
Cada par legacy/unificado comparte su intent, payment y fecha. La referencia opaca
de metadata coincide con la persistida localmente. El segundo par informa paid.
Esto demuestra que intent identifica un intento y no es una identidad inmutable de
todo el flujo. No demuestra el motivo interno de Recurrente para generar otro
intento ni permite atribuir el comportamiento de autenticación hospedada a Nexus.
Se inspeccionaron capturas existentes en memoria: sus hashes coinciden con el inbox.
No se guardaron cuerpos, firmas, datos de tarjeta, clientes ni secretos en Git.

La documentación previamente disponible en recurrente-hu14-contrato-real.md describe
los dos formatos y campos. Su afirmación de convergencia del intent corresponde a
dos entregas del mismo intento; no se extrapola a todos los intentos del checkout.

## Identidad y transición

TRANSACCION_RECURRENTE representa la operación financiera agregada. Conserva su ID
local, clave de idempotencia y payment externo. Antes de actualizar su intent
canónico al intento exitoso, se archiva el fallo en INTENTO_RECURRENTE dentro de la
misma transacción SQL. Cada resultado del intento se inserta sin sobreescribir
evidencia anterior. El intento A sigue FALLIDA; el B queda CONFIRMADA. Si el proveedor
informa dos resultados distintos del mismo intent, ambos estados quedan auditados.
EVENTO_RECURRENTE conserva cada recepción original y la referencia al checkout.

Un payment coincidente solo identifica un candidato. Se requieren simultáneamente:

- checkout externo y asociación local inequívocos;
- cuota, casa, residente y usuario coherentes en checkout/transacción/propiedad;
- monto exacto autorizado, moneda GTQ, Sandbox configurado y live_mode=false;
- payment compartido consistente en todos los lugares suministrados;
- evento auténtico, estado paid y latest_intent coincidente con el éxito;
- metadata opaca coincidente cuando existe;
- timestamp oficial válido posterior al intento fallido/cancelado (precisión de microsegundos);
- recibo original del fallo PROCESADO, con ambiente, checkout y resultado coherentes;
- ausencia de PAGO/aplicación previa y de otras transacciones incompatibles;
- saldo común compatible, sin sobrepago, aplicando recargos antes que capital.

La fecha contable es la fecha del éxito en America/Guatemala. La fecha del fallo
permanece en el historial. La transacción agregada y sus consumidores HU16/HU17/HU18
utilizan el intent exitoso. La clave local de idempotencia continúa identificando
la operación original y no se renueva por un nuevo intento.

## Migración y respaldos

006_recurrente_intent_history.sql solo crea INTENTO_RECURRENTE y
REVISION_EVENTO_RECURRENTE mediante CREATE TABLE IF NOT EXISTS, con PK, FK, UNIQUE,
CHECK e índices. No modifica 005, no actualiza filas existentes y no hace backfill.
El archivo de revisión retiene estado/error/contador/fecha de procesamiento anteriores
y el resultado de la recuperación. Ambas tablas se incluyen en backup/restore.
Los tests validan reaplicación y restauración real del historial no vacío.

## Recuperación local explícita

No se expone una ruta pública sin firma. El CLI privilegiado
backend/scripts/reprocess-recurrente-review.js funciona exclusivamente con la base
TEST/puerto explícitos y es de lectura salvo --prepare-schema o --apply.

Para eventos antiguos, EVENTO_RECURRENTE no conserva el body. El CLI obtiene solamente
una captura ya existente del inspector local ngrok, selecciona el svix-id original
y exige igualdad SHA-256 con el hash del inbox. No copia cuerpos ni firmas a archivos,
no inventa headers y no hace solicitudes a Recurrente ni al webhook público.
Si el body original ya no está disponible, se detiene: no se reconstruye desde una
versión sanitizada. La confianza proviene de la recepción original, verificada por
Svix antes de persistir, y de la igualdad exacta del digest.

El motor vuelve a normalizar el body y exige PAYMENT en el Sandbox configurado.
Bloquea el inbox, cuota, checkout e identidad financiera. Un REVISION conserva
svix-id/hash/recibido_en; su estado/error anteriores se archivan antes del cambio.
PAGO, PAGO_ORIGEN, ambos intents, transacción, checkout e inbox se confirman juntos.
Un error SQL revierte la recuperación, manteniendo la revisión original sin abonos.
Un PROCESADO idéntico es duplicate. Dos recuperaciones o una entrega concurrente
convergen en un solo PAGO. No se recupera automáticamente al arrancar ni por tiempo.

Después de autorización explícita del usuario, desde backend, en PowerShell:

```powershell
$env:RUN_PHASE0_MYSQL_TESTS='1'
$env:PHASE0_TEST_DATABASE='nexus_phase0_test_20261001_a9a8f83b'
$env:PHASE0_TEST_PORT='20378'
node scripts/reprocess-recurrente-review.js --prepare-schema
node scripts/reprocess-recurrente-review.js --event=1074
node scripts/reprocess-recurrente-review.js --event=1074 --apply
node scripts/reprocess-recurrente-review.js --event=1075 --apply
```

El primer comando aplica únicamente 006; el segundo verifica el recibo/captura sin
escribir. El tercero debe recuperar el éxito existente. El cuarto debe terminar
duplicate. Hay que auditar después exactamente un PAGO de Q5 y saldo Q0, y reiniciar
el backend TEST para cargar el código corregido antes de continuar la validación
manual HU18. No ejecutar todavía estos comandos sobre la evidencia real.

## Estado público y regresión

Un éxito en REVISION prevalece sobre un fallo anterior en la vista del residente:
INCIERTO, «Pago en verificación», acción NINGUNA y mensaje que impide otro pago.
El backend también bloquea creación y retry antes de consultar al proveedor.
Un fallo genuino sin éxito posterior mantiene HU15 sin cambios; una operación ya
confirmada no se degrada por un fallo tardío. El retorno del navegador no confirma
el pago.

Los fixtures del nuevo contrato usan IDs y firmas TEST sintéticos. Las suites usan
bases desechables propiedad del runner, con la base manual en solo lectura. Se
protegen por contenido 171/998/1210 y sus eventos. No se aplicó 006 ni se recuperaron
los eventos reales durante la implementación.

## Archivos de esta corrección

Ocho archivos nuevos (rutas relativas a proyecyo-1):

- backend/sql/migrations/006_recurrente_intent_history.sql
- backend/scripts/reprocess-recurrente-review.js
- backend/src/services/recurrenteIntentHistory.js
- backend/src/services/recurrenteReviewGuard.js
- backend/src/services/__tests__/recurrenteRecoveryCapture.test.js
- backend/test/integration/correlation.mysql.test.js
- backend/test/integration/support/recurrenteRecoveryFixtures.js
- docs/recurrente-intentos-y-recuperacion.md

Veintiún archivos existentes modificados, conservando sus cambios anteriores:

- backend/package.json
- backend/server.js
- backend/scripts/migrate-recurrente.js
- backend/scripts/start-hu13-sandbox.js
- backend/scripts/run-isolated-tests.js
- backend/src/database/recurrenteMigration.js
- backend/src/database/backupTables.js
- backend/src/database/__tests__/recurrenteMigration.test.js
- backend/src/services/recurrenteWebhookPayload.js
- backend/src/services/recurrenteWebhookService.js
- backend/src/services/recurrenteAttemptService.js
- backend/src/services/recurrenteCheckoutService.js
- backend/src/services/recurrenteCheckoutStatus.js
- backend/src/services/recurrenteReconciliationService.js
- backend/src/services/__tests__/recurrenteCheckoutService.test.js
- backend/src/services/__tests__/recurrenteCheckoutStatus.test.js
- backend/test/integration/hu15.mysql.test.js
- backend/test/integration/phase0.mysql.test.js
- backend/test/integration/support/suiteIsolation.js
- frontend/src/views/ResidentePaymentReturnView.tsx
- frontend/src/views/ResidentePaymentReturnView.hu15.test.tsx

No se modificaron 005 ni backend/.env. No hay migración de datos financieros en
006. La preparación y recuperación reales permanecen pendientes de autorización.

## Validación final del 4 de octubre de 2026

| Ejecución | Aprobadas | Fallidas | Omitidas |
|---|---:|---:|---:|
| Correlación/recuperación MySQL nueva | 33 | 0 | 0 |
| HU14 MySQL | 74 | 0 | 0 |
| HU15 MySQL | 54 | 0 | 0 |
| HU16 MySQL | 30 | 0 | 0 |
| HU17 MySQL | 23 | 0 | 0 |
| HU18 MySQL | 44 | 0 | 0 |
| Fase 0 MySQL | 25 | 0 | 0 |
| HU13 MySQL | 27 | 0 | 0 |
| Backend completo: 93 node:test + 669 Jest | 762 | 0 | 0 |
| Funcionales existentes | 12 | 0 | 0 |
| Frontend: 46 archivos | 167 | 0 | 0 |

Total MySQL: 310 pruebas. Build frontend exitoso. git diff --check: exit 0.
Se corrigió el fixture anterior de HU15 que omitía el payment fallido y fechaba el
éxito antes del fallo: ahora exige el contrato fuerte, un agregado y dos intents
históricos. El test Fase 0 verifica que tablas vacías exportan cero INSERT, mientras
la suite nueva restaura ambas tablas de auditoría con registros reales TEST.

Todas las bases temporales propias se eliminaron tras comprobar propietario y
preservación de la base compartida. La comparación final SHA-256 de filas completas
de las ocho tablas financieras manuales coincide con el baseline previo a esta
corrección: CUOTA 1210, RECARGO_APLICADO 1102, PAGO 599, PAGO_ORIGEN 599,
CHECKOUT_RECURRENTE 1073, TRANSACCION_RECURRENTE 467, EVENTO_RECURRENTE 768 y
REEMBOLSO_RECURRENTE 33. Esto incluye fechas, importes, estados, asociaciones e IDs.

Cuota 1210: saldo Q5, cero PAGO, checkout 1139 PENDIENTE/unpaid, transacción 601
FALLIDA con el intent original. Eventos 1072/1073 PROCESADO; 1074/1075 REVISION con
WEBHOOK_TRANSACTION_MISMATCH e intentos=1. Cuota 171 conserva PAGO 395, transacción
296 CONFIRMADA, checkout 433 CONFIRMADO/paid y saldo Q0. Cuota 998 conserva cero
PAGO, transacción 486 FALLIDA, checkout 937 PENDIENTE/unpaid y saldo Q5.

006 no se aplicó en la base manual compartida ni se reinició su backend. No hubo
llamadas a Recurrente ni pagos, checkouts, refunds o replays reales. No se modificó
la base normal, backend/.env ni Git mediante commit, push, PR, merge, staging o
ramas. Los cambios previos del usuario se preservaron.
