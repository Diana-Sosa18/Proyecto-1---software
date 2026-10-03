# HU14 — Confirmación y registro de transacciones reales

Actualización del contrato real: [Corrección posterior a las entregas Sandbox 348/349](recurrente-hu14-contrato-real.md). Las referencias siguientes a ignorar payment_intent.succeeded o exigir live_mode exclusivamente en la raíz describen la implementación inicial y quedan sustituidas por esa corrección.

Implementación validada el 2 de octubre de 2026, únicamente con firmas sintéticas, mocks e infraestructura MySQL TEST. No se realizaron llamadas a la API de Recurrente, registros de endpoints, túneles ni nuevos pagos Sandbox. Este documento cubre los 25 puntos solicitados.

## 1. Resultado y alcance

Se implementó el fulfillment de pagos Sandbox: webhook firmado → inbox persistente → correlación con checkout HU13 → transacción confirmada → PAGO/PAGO_ORIGEN → checkout confirmado → saldo calculado por la lógica financiera común. El retorno del navegador continúa pendiente y consultar la cuenta vuelve a obtener el saldo del backend. HU15–HU19 quedan fuera de la implementación; sus eventos solamente se reconocen como no procesables por HU14.

## 2. Archivos creados por HU14

- backend/sql/migrations/003_recurrente_confirmation.sql
- backend/src/config/recurrenteWebhook.js
- backend/src/config/__tests__/recurrenteWebhook.test.js
- backend/src/controllers/recurrenteWebhookController.js
- backend/src/services/recurrenteWebhookPayload.js
- backend/src/services/recurrenteWebhookService.js
- backend/src/services/__tests__/recurrenteWebhookPayload.test.js
- backend/src/__tests__/recurrenteWebhook.routes.test.js
- backend/test/integration/hu14.mysql.test.js
- backend/test/integration/support/recurrenteWebhookFixtures.js
- docs/recurrente-hu14.md

## 3. Archivos modificados por HU14

La comparación se realizó contra una instantánea tomada al comenzar HU14, incluyendo los cambios pendientes de Fase 0/HU13. No se eliminaron archivos. Los 36 archivos con cambios preexistentes registrados antes de Fase 0 conservan sus hashes.

- backend/package-lock.json
- backend/package.json
- backend/scripts/migrate-recurrente.js
- backend/scripts/start-hu13-sandbox.js
- backend/scripts/test-phase0-functional.js
- backend/server.js
- backend/sql/Dockerfile
- backend/src/app.js
- backend/src/database/recurrenteMigration.js
- backend/src/database/__tests__/recurrenteMigration.test.js
- backend/src/__tests__/recurrenteRawBody.test.js
- backend/test/integration/hu13.mysql.test.js
- backend/test/integration/phase0.mysql.test.js
- frontend/src/views/ResidentePaymentReturnView.test.tsx

El código de la pantalla de retorno ya tenía el botón seguro para volver a la cuenta; se amplió su prueba, sin agregar confirmaciones desde query params. El lockfile conserva el formato v3 y todas las entradas previas de paquetes; solo añade Svix y sus tres dependencias.

## 4. Migración

backend/sql/migrations/003_recurrente_confirmation.sql, posterior a 001 y 002. Se aplicó y reaplicó en MySQL TEST sin modificar filas anteriores. No contiene DROP TABLE, DROP COLUMN, DELETE ni TRUNCATE. Un único ALTER amplía atómicamente el CHECK de estado del inbox, conservando todos sus estados anteriores y agregando REVISION.

- EVENTO_RECURRENTE: sandbox_id, live_mode y UNIQUE (id_evento, ambiente).
- TRANSACCION_RECURRENTE: id_pago_externo, id_evento, fecha_proveedor_utc DATETIME(6), fecha_proveedor_original, capital_aplicado_centavos y recargo_aplicado_centavos.
- UNIQUE (ambiente, id_pago_externo), FK (id_evento, ambiente) al inbox y CHECK de suma capital/recargo aplicado igual al monto.
- Columnas nuevas admiten NULL para conservar compatibilidad con registros anteriores.
- 001/002/003 se ejecutan secuencialmente desde el servidor, el migrador, la inicialización SQL Docker y los arneses aislados. Cada migración usa un bloqueo MySQL y preparación DDL repetible.

Los catálogos de respaldo/restauración ya incluyen las cinco tablas y SELECT * conserva los nuevos campos. Se agregó 003 a la preparación del destino TEST de restauración; la regresión comparó las filas originales/restauradas, incluidos timestamps con microsegundos y nuevas FK.

## 5. Endpoint

POST /webhooks/recurrente. Sin autenticación de sesión. Se monta antes de express.json mediante recurrenteRawBody.js. Solo application/json, máximo 1 MB; se rechazan cuerpos comprimidos y UTF8 inválido para conservar los bytes firmados. La ausencia de configuración devuelve 503; la ruta no queda habilitada para aplicar dinero sin signing secret.

## 6. Contrato financiero

Únicamente event_type=intent.succeeded, type=payment y status=succeeded. Se exige amount_in_cents entero positivo, currency=GTQ, identificador del intent, checkout.id y created_at confiable. Si viene checkout.status debe ser paid. payment.id se conserva y deduplica si está presente. Metadata nexus_checkout_reference es una verificación secundaria; nunca crea una asociación.

Se acepta el objeto unificado directo y el envelope Svix documentado con data.event_type; ambos se verifican sobre el body completo original y se rechaza un envelope que mezcle dos cuerpos financieros. Los identificadores se tratan como referencias opacas ASCII, sin inferir ambiente por prefijos.

payment_intent.succeeded legacy, otros métodos de pago, reembolsos y suscripciones se guardan como IGNORADO sin aplicación financiera. Recurrente puede enviar ambos contratos, por eso solo el unificado produce PAGO. [Migración a webhooks unificados](https://docs.recurrente.com/guides-english/guides/migrate-to-unified-webhooks), [contrato intent.succeeded](https://docs.recurrente.com/referencia-api/api-reference/webhook-events/intent-succeeded-webhook).

## 7. Verificación Svix

Biblioteca oficial svix fijada en 1.99.1, compatible con CommonJS/Node 20 del Docker existente. La versión 2.5.0 recomendada en la guía actual es ESM y requiere Node 22; se comprobó esa incompatibilidad con el backend y Jest antes de seleccionar la versión compatible.

Webhook.verify recibe el Buffer original y solo svix-id, svix-timestamp y svix-signature. La biblioteca comprueba la firma y la ventana de cinco minutos del timestamp de entrega. La interpretación del JSON ocurre después de verificar. Signing secret independiente de Secret Key, leído del backend y no enumerable en la configuración. No se usa el cliente API de Svix ni se contacta al proveedor. [Verificación oficial](https://docs.svix.com/receiving/verifying-payloads/how).

## 8. Sandbox

Antes de cualquier aplicación financiera se exige live_mode exactamente false y sandbox_id exactamente igual a RECURRENTE_SANDBOX_ID. Producción, otro sandbox o ambiente incompleto quedan IGNORADO con WEBHOOK_ENVIRONMENT_MISMATCH. La auditoría conserva los indicadores recibidos; un ambiente ausente se archiva en el inbox del receptor Sandbox con indicador NULL y error explícito, sin declarar que fue validado. Nunca se infiere ambiente a partir de una llave o un ID. [Sandboxes oficiales](https://docs.recurrente.com/guides-english/guides/sandboxes-and-test-clocks).

## 9. Idempotencia y concurrencia

UNIQUE (ambiente, svix_id) más hash SHA256 del body. El inbox se persiste antes de la transacción financiera; después se bloquea su fila. Un mismo svix-id con bytes diferentes se rechaza con 409 y conserva el registro original.

Se bloquea la cuota antes del checkout, en el mismo orden usado por HU13/pagos académicos. READ COMMITTED se aplica solo a esta transacción para que un proceso que esperó el bloqueo vea los pagos recién confirmados. UNIQUE por intent externo, payment externo y PAGO son la defensa adicional entre obligaciones distintas. Un fallo de unicidad concurrente revierte todo y responde 503; su reintento identifica la operación previa, sin duplicar dinero.

## 10. Correlación y aplicación contable

checkout.id externo → CHECKOUT_RECURRENTE de Sandbox → cuota/casa/residente/usuario persistidos, contrastados con las relaciones actuales → GTQ y monto autorizado exactos → intent/payment deduplicados → PAGO con monto DECIMAL exacto → PAGO_ORIGEN RECURRENTE/sandbox → TRANSACCION_RECURRENTE CONFIRMADA → checkout CONFIRMADO/paid → inbox PROCESADO.

Todos los cambios financieros y el estado final del inbox se confirman en una sola transacción. Una transacción local PENDIENTE compatible puede confirmarse conservando su identificador. Una confirmación antigua sin PAGO queda en REVISION y no se repara inventando un asiento.

La regla de fecha aprobada utiliza created_at firmado convertido explícitamente a America/Guatemala. Por ejemplo, 2026-08-01T02:30:00.123456Z genera PAGO.fecha_pago=2026-07-31. Se conservan el timestamp original y el equivalente UTC con seis decimales; recibido_en, procesado_en y confirmado_en quedan separados. Un replay no cambia fecha_pago. Si falta zona horaria, el calendario es inválido o falta created_at, el inbox queda REVISION/WEBHOOK_PAYMENT_DATE_UNTRUSTED sin PAGO; ese caso debe investigarse antes de aplicar dinero.

## 11. Replay

Un inbox PROCESADO devuelve 200/duplicate sin reescritura. Otro svix-id para la misma transacción compatible también devuelve duplicate y marca el nuevo inbox procesado. Legacy después del unificado no crea PAGO. Otra transacción para un checkout ya confirmado queda en revisión. Un evento con timestamp contable distinto no cambia el asiento existente.

## 12. Fallo temporal y respuestas HTTP

| Situación | HTTP | Aplicación |
|---|---:|---|
| Pago aplicado / duplicado | 200 | Una sola aplicación |
| Evento no soportado / ambiente no válido | 200, ignored | Ningún PAGO |
| Inconsistencia financiera persistida | 200, review | Ningún PAGO nuevo |
| Firma ausente, alterada o fuera de ventana | 401 | Sin inbox financiero |
| JSON/envelope no válido | 400 | Sin aplicación |
| Content-Type/compresión no válido | 415 | Sin aplicación |
| svix-id reutilizado con otro body | 409 | Conserva el original |
| Signing secret/configuración ausente | 503 | Sin procesamiento |
| DB/SQL temporal, checkout no localizado | 503 | Reintento seguro |

Si el evento llega antes de que HU13 guarde el ID externo del checkout, queda FALLIDO reintentable y responde 503; no se vincula automáticamente desde metadata. Lo mismo ocurre para un checkout externo desconocido: no se aplica y permanece pendiente de investigación/reintento. No hay un trabajador que confirme sin el evento firmado; se requiere nueva entrega de Svix.

Rollback conserva el inbox recibido, sin PAGO/origen/transacción/confirmación parcial. Se guarda únicamente un código local seguro. Si COMMIT se ejecutó pero se perdió su respuesta, se responde 503 y el replay comprueba PROCESADO, conservando un solo PAGO. No se imprimen errores SQL, payloads ni headers. [Reintentos del proveedor](https://docs.recurrente.com/guias-espanol/comenzar/webhooks).

## 13. Inconsistencias y reglas financieras

Monto o moneda diferente, metadata de otra obligación, asociación local incoherente, sobrepago histórico o pago que excede el saldo actual: REVISION, código de causa, sin dinero nuevo. El checkout no se libera mediante tiempo transcurrido ni pagos simulados. La resolución administrativa corresponde a una etapa posterior.

La lógica común de Fase 0 calcula todos los abonos confirmados sin filtro temporal. Los movimientos sí respetan el período, usando la fecha contable de Guatemala.

| Capital | Recargos | Abono confirmado | Capital pendiente | Recargos pendientes | Saldo |
|---:|---:|---:|---:|---:|---:|
| Q100 | Q15 | Q10 | Q100 | Q5 | Q105 |
| Q100 | Q15 | Q50 | Q65 | Q0 | Q65 |
| Q100 | Q15 | Q115 | Q0 | Q0 | Q0 |

También se verificaron Q10.01=1001 centavos y abonos concurrentes Q50+Q10 → Q55 pendientes. Dos abonos Q80 sobre Q115 permiten una sola aplicación y Q35 pendientes. Sobrepago histórico Q120 sobre Q115 permanece visible como Q5 de exceso y bloquea otro asiento. No hay saldo negativo ni aumento silencioso del monto. Un pago fuera de agosto liquida la cuota aunque no se liste como movimiento de agosto.

## 14–18. Validación ejecutada

Infraestructura: MySQL 8.4.8, contenedor nexus-phase0-test-20261001-a9a8f83b, 127.0.0.1:20378, base nexus_phase0_test_20261001_a9a8f83b. Restauraciones exclusivamente en nexus_phase0_test_20261001_a9a8f83b_restore.

| Validación | Aprobadas | Fallidas | Omitidas |
|---|---:|---:|---:|
| Backend node:test | 93 | 0 | 0 |
| Backend Jest, 42 suites | 316 | 0 | 0 |
| Backend completo | 409 | 0 | 0 |
| Frontend, 38 archivos | 106 | 0 | 0 |
| MySQL HU14 | 51 | 0 | 0 |
| MySQL HU13 | 27 | 0 | 0 |
| MySQL Fase 0, incluyendo backup/restore | 25 | 0 | 0 |
| Funcionales existentes HTTP | 12 | 0 | 0 |
| Funcionales HTTP HU14 | 3 | 0 | 0 |

Las tres funcionales HU14 están incluidas en las 51 pruebas MySQL, no se suman otra vez. Cubren entrega concurrente/replay y consulta autenticada de saldo, bloqueo de nuevo checkout con cuota pagada, rollback HTTP 503 con posterior reintento 200 e inconsistencias de monto/fecha sin PAGO. Las 51 MySQL también cubren validaciones de ambiente, legacy, IDs duplicados, cambio de saldo, cinco fallos SQL en distintas etapas y pérdida de respuesta a COMMIT.

Frontend: tres pruebas nuevas, query params sin confirmación ni llamadas financieras y retorno a cuenta que consulta saldo backend. La pantalla productiva continúa pendiente de verificación.

Build frontend: exit 0, 2377 módulos; advertencia ya existente de chunk mayor de 500 kB. Comprobaciones de sintaxis backend y coherencia package.json/lockfile: OK.

Comandos ejecutados desde backend (las variables deben definirse en el proceso, sin editar .env):

```powershell
$env:RUN_PHASE0_MYSQL_TESTS='1'
$env:PHASE0_TEST_DATABASE='nexus_phase0_test_20261001_a9a8f83b'
$env:PHASE0_TEST_PORT='20378'
npm.cmd run test:hu14:mysql
npm.cmd run test:hu13:mysql
npm.cmd run test:phase0:mysql
npm.cmd run test:phase0:functional
```

Para backend completo se vaciaron las tres variables Recurrente solamente en el proceso de pruebas antes de npm.cmd test; los arneses MySQL/funcionales también las vacían antes de cargar configuración. Desde frontend: npm.cmd run test:run y npm.cmd run build.

## 19. git diff --stat

Salida global contra HEAD: incluye cambios anteriores pendientes, no únicamente HU14. Git no incluye los archivos nuevos sin seguimiento en este stat; los archivos HU14 creados están enumerados arriba.

```text
 proyecyo-1/.env.example                            |  5 ++
 proyecyo-1/backend/.env.example                    |  6 ++
 proyecyo-1/backend/package-lock.json               | 30 +++++++++-
 proyecyo-1/backend/package.json                    | 10 +++-
 proyecyo-1/backend/server.js                       |  8 ++-
 proyecyo-1/backend/sql/Dockerfile                  |  3 +
 proyecyo-1/backend/src/app.js                      | 14 +++--
 proyecyo-1/backend/src/config/env.js               |  3 +
 proyecyo-1/backend/src/database/mysql.js           |  5 +-
 .../__tests__/adminPaymentsService.test.js         |  1 +
 .../__tests__/paymentRemindersRecipients.test.js   |  3 +-
 .../__tests__/simulatedPaymentsService.test.js     | 56 ++++++++++++++++--
 .../backend/src/services/adminPaymentsService.js   | 67 +++++++++++++---------
 .../backend/src/services/adminRemindersService.js  | 17 +++---
 .../src/services/automaticBackupsService.js        | 38 ++++++++----
 .../backend/src/services/financialRulesService.js  |  8 ++-
 .../backend/src/services/passwordResetService.js   |  3 +-
 .../backend/src/services/reportExportService.js    | 18 +++---
 .../backend/src/services/residentAccountService.js | 29 ++++------
 .../src/services/residentFinancialDetailService.js | 32 +++++------
 proyecyo-1/backend/src/services/restoresService.js | 42 +++++++++++++-
 .../src/services/simulatedPaymentsService.js       | 25 ++++++--
 .../backend/src/services/tenantAccountService.js   | 33 +++++------
 proyecyo-1/backend/src/services/visitsService.js   |  5 +-
 proyecyo-1/backend/test/detalleFinanciero.test.js  |  1 +
 proyecyo-1/backend/test/reportExport.test.js       | 10 ++--
 proyecyo-1/backend/test/residentAccount.test.js    |  1 +
 proyecyo-1/backend/test/tenantAccount.test.js      |  1 +
 proyecyo-1/docker-compose.yml                      |  3 +
 proyecyo-1/frontend/.dockerignore                  | 21 +++++++
 .../frontend/src/components/admin/AdminLayout.tsx  |  5 ++
 proyecyo-1/frontend/src/routes/AppRouter.tsx       |  2 +
 proyecyo-1/frontend/src/services/accountService.ts |  2 +-
 proyecyo-1/frontend/src/services/api.ts            |  5 +-
 .../frontend/src/services/tenantAccountService.ts  |  2 +-
 proyecyo-1/frontend/src/types/account.ts           |  5 +-
 proyecyo-1/frontend/src/types/financialDetail.ts   |  6 +-
 proyecyo-1/frontend/src/types/payments.ts          |  4 +-
 proyecyo-1/frontend/src/types/tenantAccount.ts     |  5 +-
 .../views/AdminMonthlyFinancialReportView.test.tsx |  9 +++
 .../src/views/AdminMonthlyFinancialReportView.tsx  | 14 ++++-
 .../frontend/src/views/AdminPaymentsView.tsx       |  4 +-
 .../frontend/src/views/InquilinoAccountView.tsx    |  3 +
 .../views/ResidenteAccountView.payment.test.tsx    | 67 ++++++++++++++--------
 .../frontend/src/views/ResidenteAccountView.tsx    | 63 +++++++++-----------
 .../src/views/ResidenteFinancialDetailView.tsx     |  5 +-
 46 files changed, 475 insertions(+), 224 deletions(-)
```

## 20. git status --short

```text
 M .env.example
 M backend/.env.example
 M backend/package-lock.json
 M backend/package.json
 M backend/server.js
 M backend/sql/Dockerfile
 M backend/src/app.js
 M backend/src/config/env.js
 M backend/src/database/mysql.js
 M backend/src/services/__tests__/adminPaymentsService.test.js
 M backend/src/services/__tests__/paymentRemindersRecipients.test.js
 M backend/src/services/__tests__/simulatedPaymentsService.test.js
 M backend/src/services/adminPaymentsService.js
 M backend/src/services/adminRemindersService.js
 M backend/src/services/automaticBackupsService.js
 M backend/src/services/financialRulesService.js
 M backend/src/services/passwordResetService.js
 M backend/src/services/reportExportService.js
 M backend/src/services/residentAccountService.js
 M backend/src/services/residentFinancialDetailService.js
 M backend/src/services/restoresService.js
 M backend/src/services/simulatedPaymentsService.js
 M backend/src/services/tenantAccountService.js
 M backend/src/services/visitsService.js
 M backend/test/detalleFinanciero.test.js
 M backend/test/reportExport.test.js
 M backend/test/residentAccount.test.js
 M backend/test/tenantAccount.test.js
 M docker-compose.yml
 M frontend/.dockerignore
 M frontend/src/components/admin/AdminLayout.tsx
 M frontend/src/routes/AppRouter.tsx
 M frontend/src/services/accountService.ts
 M frontend/src/services/api.ts
 M frontend/src/services/tenantAccountService.ts
 M frontend/src/types/account.ts
 M frontend/src/types/financialDetail.ts
 M frontend/src/types/payments.ts
 M frontend/src/types/tenantAccount.ts
 M frontend/src/views/AdminMonthlyFinancialReportView.test.tsx
 M frontend/src/views/AdminMonthlyFinancialReportView.tsx
 M frontend/src/views/AdminPaymentsView.tsx
 M frontend/src/views/InquilinoAccountView.tsx
 M frontend/src/views/ResidenteAccountView.payment.test.tsx
 M frontend/src/views/ResidenteAccountView.tsx
 M frontend/src/views/ResidenteFinancialDetailView.tsx
?? .gitignore
?? backend/.dockerignore
?? backend/scripts/
?? backend/sql/.dockerignore
?? backend/sql/migrations/
?? backend/src/__tests__/
?? backend/src/config/__tests__/
?? backend/src/config/recurrente.js
?? backend/src/config/recurrenteCheckout.js
?? backend/src/config/recurrenteWebhook.js
?? backend/src/controllers/recurrenteCheckoutController.js
?? backend/src/controllers/recurrenteWebhookController.js
?? backend/src/database/__tests__/
?? backend/src/database/backupTables.js
?? backend/src/database/recurrenteMigration.js
?? backend/src/middlewares/recurrenteRawBody.js
?? backend/src/middlewares/requireResidentSession.js
?? backend/src/routes/recurrenteCheckoutRoutes.js
?? backend/src/services/__tests__/financialBackups.test.js
?? backend/src/services/__tests__/financialBalance.test.js
?? backend/src/services/__tests__/financialPeriods.test.js
?? backend/src/services/__tests__/recurrenteCheckoutService.test.js
?? backend/src/services/__tests__/recurrenteClient.test.js
?? backend/src/services/__tests__/recurrenteWebhookPayload.test.js
?? backend/src/services/__tests__/surchargeBalance.test.js
?? backend/src/services/financialBalance.js
?? backend/src/services/recurrenteCheckoutErrors.js
?? backend/src/services/recurrenteCheckoutGuard.js
?? backend/src/services/recurrenteCheckoutService.js
?? backend/src/services/recurrenteClient.js
?? backend/src/services/recurrenteWebhookPayload.js
?? backend/src/services/recurrenteWebhookService.js
?? backend/src/utils/__tests__/safeLogger.test.js
?? backend/src/utils/recurrenteCheckoutUrl.js
?? backend/src/utils/safeLogger.js
?? backend/test/integration/
?? docs/recurrente-fase0-validacion-mysql.md
?? docs/recurrente-fase0.md
?? docs/recurrente-hu13.md
?? docs/recurrente-hu14.md
?? evidencias_sprint/
?? frontend/src/components/payments/
?? frontend/src/services/api.serialization.test.ts
?? frontend/src/services/recurrenteCheckoutService.test.ts
?? frontend/src/services/recurrenteCheckoutService.ts
?? frontend/src/types/financialBalance.ts
?? frontend/src/types/recurrenteCheckout.ts
?? frontend/src/views/ResidentePaymentReturnView.test.tsx
?? frontend/src/views/ResidentePaymentReturnView.tsx
?? "../rt -uo"
```

git diff --check: exit 0, sin errores de whitespace. Staging vacío. No se hicieron commits, push, merge ni ramas. Los avisos LF→CRLF de Git corresponden a la política existente; no se cambió esa configuración.

## 21. Secretos y logs

backend/.env permanece idéntico al iniciar HU14, comprobado mediante hash sin mostrar su contenido. RECURRENTE_SECRET_KEY y RECURRENTE_SANDBOX_ID: configuradas; RECURRENTE_WEBHOOK_SECRET: vacío. No se modificó ninguno. backend/.env y frontend/.env están ignorados y no rastreados por Git. No hay Secret Key/webhook secret en frontend, respuestas, BD, archivos nuevos, logs de pruebas ni bundle. La búsqueda de coincidencias con las credenciales locales no encontró filtraciones en 456 archivos revisados. Las firmas automatizadas usan un secret sintético generado en fixtures, nunca un valor real ni .env.example.

## 22. Base normal

No se inició el servidor normal ni se ejecutó el migrador con la configuración normal. Todos los procesos que consultaron/aplicaron SQL pasaron por la validación explícita de nombre TEST y puerto aislado. No se consultó ni modificó la base normal; no se eliminaron sus datos.

## 23. Recurrente y acciones externas

Cero llamadas a app.recurrente.com/api durante HU14. Se consultó documentación pública para contrastar el contrato. No se registraron endpoints, no se creó/configuró/instaló túnel, no se modificó el signing secret real y no se hizo otro checkout/pago Sandbox. No se implementaron reembolsos, suscripciones ni conciliación.

## 24. Pago Sandbox anterior

La confirmación visual de Recurrente fue reportada por el usuario; esta implementación no la convirtió retroactivamente en PAGO. La inspección actual del TEST indicado encuentra HU13 Sandbox Q5 TEST, cuota 171, Q5.00, cero PAGO y cero CHECKOUT_RECURRENTE asociados. Esta situación ya estaba presente antes de migrar/probar HU14 y se conserva al finalizar. No se puede confirmar ni reasociar un checkout anterior que no existe localmente en esta base. No se consultó otra base ni la API para localizarlo.

Svix permite reenviar mensajes existentes desde el portal, mediante la opción resend de un intento. Eso no garantiza que exista un mensaje histórico disponible para un endpoint que aún no estaba registrado. Primero hay que comprobar el mensaje en el Sandbox y su asociación local válida; nunca reconstruirla desde datos del navegador. Si no existen mensaje y checkout local correlacionable, la prueba completa requerirá un nuevo checkout TEST después de registrar el webhook y de una nueva autorización. [Replay oficial](https://docs.svix.com/receiving/using-app-portal/replaying-messages).

## 25. Próximos pasos exactos, todavía NO ejecutados

Antes de comenzar debe autorizarse la exposición HTTPS temporal y el registro del webhook Sandbox. No se instalará ni configurará un túnel sin esa autorización. Si ngrok no está instalado o su cuenta no está preparada, primero se solicita autorización para ese paso específico; ningún token se pega en chat ni en el repositorio.

**A. Reiniciar únicamente el backend manual TEST con el código HU14.** Cerrar el proceso anterior de HU13 mediante Ctrl+C en su terminal, sin detener otros servicios. Si no se tiene acceso a esa terminal, identificar y autorizar la parada del proceso que escucha 127.0.0.1:3100 y cuyo ejecutable es node.exe con scripts/start-hu13-sandbox.js; no detener un proceso distinto.

En una nueva PowerShell:

```powershell
Set-Location 'C:\Users\VICTUS\Documents\olasoft\Proyecto-1---software\proyecyo-1\backend'
$env:RUN_PHASE0_MYSQL_TESTS='1'
$env:PHASE0_TEST_DATABASE='nexus_phase0_test_20261001_a9a8f83b'
$env:PHASE0_TEST_PORT='20378'
npm.cmd run start:hu14:sandbox
```

Este alias utiliza el mismo arnés aislado HU13, aplica 001/002/003, enlaza 127.0.0.1:3100, no inicia schedulers y no crea checkout al arrancar. No utilizar npm.cmd start ni npm.cmd run migrate:recurrente para esta prueba. Antes de configurar signing secret, POST /webhooks/recurrente devuelve 503.

**B. Túnel con exposición de una sola ruta.** Después de la autorización y con ngrok disponible, crear fuera del repositorio el archivo temporal %TEMP%\nexus-hu14-webhook-policy.yml con este contenido:

```yaml
on_http_request:
  - expressions:
      - "req.url.path != '/webhooks/recurrente' || req.method != 'POST'"
    actions:
      - type: deny
        config:
          status_code: 404
```

En otra terminal, ejecutar:

```powershell
ngrok http http://127.0.0.1:3100 --traffic-policy-file "$env:TEMP\nexus-hu14-webhook-policy.yml" --inspect=false
```

Conservar la URL HTTPS que ngrok asigne. No usar 0.0.0.0, abrir puertos/firewall ni cambiar CORS: Recurrente envía una petición server-to-server. No añadir reglas que alteren body o headers Svix. La política deniega todas las otras rutas/métodos y --inspect=false evita introspección HTTP del agente. Comprobar públicamente que /health responde 404 y que un POST no firmado a /webhooks/recurrente responde 503 antes de configurar signing secret y 401 después. [Política deny](https://ngrok.com/docs/gateway/traffic-policy/actions/deny), [variables de petición](https://ngrok.com/docs/gateway/traffic-policy/variables/req), [opciones CLI](https://ngrok.com/docs/gateway/agent/cli).

**C. Registrar desde el Sandbox correcto.** Entrar en el Sandbox ya creado, comprobar su identidad y abrir Configuración → Desarrolladores y API → Webhooks. Agregar como endpoint la URL HTTPS completa seguida de /webhooks/recurrente. Si el panel permite filtros, seleccionar intent.succeeded; el backend igualmente ignora legacy y otros tipos. No registrar un endpoint LIVE. La guía oficial también documenta POST /api/webhook_endpoints con credenciales Sandbox; aquí no se ha ejecutado esa llamada.

**D. Signing secret local.** Obtener el signingSecret de ese endpoint, diferente de Secret Key. Colocarlo personalmente solo en C:\Users\VICTUS\Documents\olasoft\Proyecto-1---software\proyecyo-1\backend\.env, variable RECURRENTE_WEBHOOK_SECRET. No pegarlo en chat, consola, .env.example ni Git. Mantener Secret Key/Sandbox ID actuales. Reiniciar el backend manual con el mismo comando de A para cargarlo; frontend conserva VITE_API_URL=http://127.0.0.1:3100 y http://127.0.0.1:5174.

**E. Prueba posterior autorizada.** Revisar primero si el portal dispone del mensaje anterior y de un checkout local verificable en esta TEST. Si no, autorizar una nueva cuota/checkout TEST, registrar previamente el webhook y hacer el flujo manual en http://127.0.0.1:5174/login con residente@test.com. No recrear asociaciones financieras del checkout anterior por suposición. Revisar que el evento natural incluya intent.succeeded/payment, live_mode=false, sandbox_id correcto, checkout local, monto/moneda y created_at válido; si falta alguno, no inventarlo ni desactivar controles.

Comprobar en TEST: un inbox PROCESADO, una TRANSACCION_RECURRENTE CONFIRMADA, un PAGO con fecha Guatemala y origen RECURRENTE/sandbox, checkout CONFIRMADO/paid y saldo real actualizado. Reenviar ese mismo evento desde el portal y comprobar que los conteos, monto y fecha no cambian. El retorno del navegador continúa pendiente; volver a la cuenta consulta backend.

**F. Cierre de la prueba.** Detener el túnel y desactivar únicamente el endpoint Sandbox temporal al terminar, conservando auditoría y datos de prueba. No tocar endpoints LIVE ni la base normal. Estas operaciones también requieren la autorización correspondiente y no se realizaron en HU14.
