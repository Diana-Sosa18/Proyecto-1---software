# Sprint 9 — HU15: intentos rechazados, fallidos y cancelados

Responsable: Emilio. Story Points: 5. Implementación validada exclusivamente con mocks y MySQL TEST; pendiente de prueba manual autorizada.

## 1. Contratos y fuentes verificadas

- [Webhooks oficiales](https://docs.recurrente.com/guides-english/getting-started/webhooks): eventos unificados `intent.failed` y `intent.canceled`, estados `failed` y `canceled`; se admite únicamente `type: payment`.
- [Intent fallido](https://docs.recurrente.com/referencia-api/api-reference/webhook-events/intent-failed-webhook) y [cancelado](https://docs.recurrente.com/referencia-api/api-reference/webhook-events/intent-canceled-webhook): ID canónico `in_*`, `status`, `raw_status`, `created_at`, monto, moneda, `checkout`, `payment` y `details.failure_reason`. Algunos campos son opcionales para el proveedor; Nexus exige la correlación local y el ambiente antes de aplicar cualquier resultado.
- [Legacy](https://docs.recurrente.com/webhooks-legacy): `payment_intent.failed`, ID raíz `pa_*`, `checkout.id`, monto, moneda, fecha y `failure_reason` en la raíz. No se inventaron eventos `payment_intent.canceled/cancelled`.
- [Consulta oficial de checkout](https://docs.recurrente.com/referencia-api/api-reference/checkouts/get-checkout): `unpaid`, `paid`, `payment_in_progress`, `expired`.
- El contrato real exitoso de HU14 ya inspeccionado sigue descrito en [recurrente-hu14-contrato-real.md](recurrente-hu14-contrato-real.md). Los fixtures HU15 son sintéticos, basados en los campos documentados; no son capturas de un rechazo real.

Firma Svix sobre Buffer original y verificación estricta del Sandbox se reutilizan sin relajarlas: todas las ubicaciones de `live_mode` proporcionadas deben ser booleanas y concordar en false; `sandbox_id` debe coincidir exactamente. No se infiere ambiente por el prefijo de una llave.

El legacy mínimo sin `latest_intent` conserva su resultado, motivo e ID raíz en EVENTO_RECURRENTE ligado al checkout. No se inventa una TRANSACCION_RECURRENTE con ID canónico. Cuando hay correlación firmada coherente mediante `latest_intent`, ambos formatos convergen en la misma transacción. Un fallo legacy con checkout `paid` va a REVISION: no se atribuye a su último intento exitoso.

## 2. Archivos creados en HU15

- `backend/sql/migrations/004_recurrente_attempts.sql`
- `backend/src/services/recurrenteAttemptPayload.js`
- `backend/src/services/recurrenteAttemptService.js`
- `backend/src/services/recurrenteCheckoutStatus.js`
- `backend/src/services/__tests__/recurrenteAttemptPayload.test.js`
- `backend/src/services/__tests__/recurrenteCheckoutStatus.test.js`
- `backend/src/__tests__/recurrenteRetry.routes.test.js`
- `backend/test/integration/hu15.mysql.test.js`
- `backend/test/integration/support/recurrenteAttemptFixtures.js`
- `frontend/src/views/ResidentePaymentReturnView.hu15.test.tsx`
- `docs/recurrente-hu15.md`

## 3. Archivos modificados en HU15

Lista respecto al inventario de archivos tomado antes de implementar HU15; varios ya estaban modificados o sin seguimiento por Fase 0/HU13/HU14.

- `backend/package.json`
- `backend/scripts/migrate-recurrente.js`
- `backend/scripts/start-hu13-sandbox.js`
- `backend/scripts/test-phase0-functional.js`
- `backend/server.js`
- `backend/sql/Dockerfile`
- `backend/src/controllers/recurrenteCheckoutController.js`
- `backend/src/database/recurrenteMigration.js`
- `backend/src/database/__tests__/recurrenteMigration.test.js`
- `backend/src/routes/recurrenteCheckoutRoutes.js`
- `backend/src/services/recurrenteCheckoutErrors.js`
- `backend/src/services/recurrenteCheckoutGuard.js`
- `backend/src/services/recurrenteCheckoutService.js`
- `backend/src/services/recurrenteClient.js`
- `backend/src/services/recurrenteWebhookPayload.js`
- `backend/src/services/recurrenteWebhookService.js`
- `backend/test/integration/hu13.mysql.test.js`
- `backend/test/integration/hu14.mysql.test.js`
- `backend/test/integration/phase0.mysql.test.js`
- `backend/test/integration/support/isolatedMysql.js`
- `frontend/src/services/recurrenteCheckoutService.test.ts`
- `frontend/src/services/recurrenteCheckoutService.ts`
- `frontend/src/types/recurrenteCheckout.ts`
- `frontend/src/views/ResidentePaymentReturnView.tsx`

Ningún archivo preexistente fue eliminado. No se instalaron dependencias nuevas. No se modificó ningún archivo .env.

## 4. Migración

`004_recurrente_attempts.sql`: ocho columnas de auditoría, FK de EVENTO_RECURRENTE al checkout, CHECK del resultado del intento y CHECK que prohíbe PAGO, fecha de confirmación o aplicaciones de capital/recargo en una transacción FALLIDA/CANCELADA. No agrega estados al catálogo ni nuevas tablas. No contiene DROP, DELETE, UPDATE o TRUNCATE. Cada operación DDL consulta information_schema y la ejecución usa un bloqueo MySQL; fue reaplicada conservando las filas.

Se integra en migrador, arranque, Docker SQL y harnesses TEST. Fue aplicada únicamente al entorno TEST y al destino de restauración aislado de la prueba; no se ejecutó el servidor normal.

## 5. Estados y significado

| Capa | Estados utilizados | Efecto |
| --- | --- | --- |
| Intento del proveedor | failed / canceled | Resultado del intento; no prueba cierre del checkout |
| Transacción local | FALLIDA / CANCELADA | Sin id_pago, sin confirmado_en y sin aplicación financiera |
| Transacción local | CONFIRMADA | Solo HU14; un PAGO asociado |
| Checkout local | CREADO / PENDIENTE | Reserva o checkout abierto; impide un checkout adicional |
| Checkout local | INCIERTO | Resultado desconocido o consulta fallida; bloquea automáticamente |
| Checkout local | CONFIRMADO | HU14 confirmó el pago; no permite retry de ese checkout |
| Checkout local | EXPIRADO | GET autenticado confirmó expired; verificado_en registra esa evidencia |
| Checkout local | FALLIDO | HU13 conserva rechazos definitivos de creación; un ID externo obliga a verificar antes de liberar |
| Inbox | PROCESADO | Evento atendido; también puede representar un fallo de negocio sin PAGO |
| Inbox | FALLIDO | Fallo técnico SQL/transitorio; entrega podrá reintentarse |
| Inbox | REVISION / IGNORADO | Inconsistencia o fuente no admitida; sin efectos financieros |

Los estados ya existentes CANCELADO y de reembolsos permanecen en el esquema; HU15 no los inventa a partir de un regreso del navegador ni implementa HU18.

El estado financiero de la cuota depende exclusivamente del saldo común: capital + recargos - TODOS los abonos confirmados. Los movimientos conservan su filtro temporal. Un intento fallido o cancelado no es un abono.

## 6. Reintento seguro y endpoints

- `GET /residente/pagos/recurrente/checkouts/:reference`: sesión residente vigente, propiedad actual de casa/cuota, Sandbox local. Solo lee DB; no consulta Recurrente. Devuelve referencia opaca, estado, mensaje estático y acción. Cache-Control: no-store.
- `POST /residente/pagos/recurrente/reintentar`: recibe únicamente `referencia_local`. Vuelve a autorizar y calcular el saldo bajo bloqueo de cuota; no recibe monto, moneda o identidad del navegador.
- `POST /residente/pagos/recurrente/checkout`: flujo HU13 conservado, también puede resolver una expiración verificada de un checkout compatible.

Antes del GET/POST al proveedor el cliente mantiene la verificación GET /api/test: environment sandbox y sandbox_id exacto.

| Estado autoritativo | Decisión |
| --- | --- |
| unpaid | Solo reutilizar un checkout compatible, con URL validada; no otro POST |
| paid | Bloquear; la confirmación contable corresponde a HU14, nunca a este GET |
| payment_in_progress | Bloquear checkout adicional |
| expired | Marcar EXPIRADO y reservar sucesor en la misma transacción, si saldo > 0, mínimo Q5 y sin otra operación bloqueante |
| Resultado no determinable | INCIERTO, sin liberación por tiempo o por cancel_url |

El retry explícito permite verificar un checkout cuyo monto quedó obsoleto para determinar si realmente expiró; si permanece unpaid, no reutiliza ese monto. El nuevo monto, capital y recargos siempre se recalculan en backend.

Una cuota Q0, con sobrepago histórico o saldo inferior a Q5 no se cobra. Otro checkout bloqueante desactiva el retry en la consulta de estado. La petición POST revalida incluso después de haber mostrado un botón permitido.

El retorno consulta únicamente el backend mediante la referencia opaca, muestra carga, errores seguros y la acción decidida por el servidor. Una continuación requiere click explícito, evita doble click y valida la URL de Recurrente antes de redirigir. Parámetros como status=paid o canceled=true no confirman ni cancelan financieramente. Regresar sin evidencia mantiene pendiente de verificación.

## 7. Duplicados, concurrencia y rollback

- UNIQUE persistente ambiente + svix-id, hash del body inmutable y bloqueo del inbox.
- UNIQUE de intent canónico/ID de pago externo cuando está disponible. Eventos diferentes del mismo intento no crean otra transacción.
- Orden de bloqueo conservado: cuota, luego checkout. La liberación por expired y la reserva CREADO del sucesor se confirman juntas, sin ventana intermedia.
- INCIERTO se escribe antes de consultar o crear una operación externa. Un timeout, 5xx o respuesta inválida no permite otro checkout.
- Intento y resultado del inbox se confirman juntos; un fallo SQL revierte ambos. La recepción durable conserva la posibilidad de reentrega.
- Un resultado negativo contradictorio nunca degrada una transacción confirmada. Resultados incompatibles del mismo intent van a revisión.
- Los pagos simulados permanecen bloqueados sobre operaciones Recurrente activas o inciertas y sobre cierres externos no verificados.

## 8. Motivos y datos sensibles

Se lee exclusivamente failure_reason documentado. No se persiste texto libre del proveedor: se clasifica en un catálogo local (BANK_DECLINED, INSUFFICIENT_FUNDS, INTENT_FAILED, INTENT_CANCELED), con mensaje sanitizado fijo. Estos son códigos locales, no una afirmación sobre códigos no documentados del proveedor.

Se conservan motivo, resultado y asociación en el inbox; cuando existe ID canónico confiable, también en la transacción. El motivo libre desconocido se omite, dejando constancia de que fue informado y omitido por seguridad. No se guarda PAN, CVC, clientes, firmas, credenciales ni payload completo. La fecha original y UTC se guardan cuando son válidas; recepción/procesamiento SQL quedan por separado. Un fallo sin fecha de proveedor no inventa fecha contable ni crea PAGO.

## 9–16. Validación final automatizada

Base: nexus_phase0_test_20261001_a9a8f83b, MySQL 8.4.8, 127.0.0.1:20378. Contenedor existente nexus-phase0-test-20261001-a9a8f83b.

| Validación | Aprobadas | Fallidas | Omitidas |
| --- | ---: | ---: | ---: |
| Backend Node | 93 | 0 | 0 |
| Backend Jest, 45 suites | 404 | 0 | 0 |
| Backend total | 497 | 0 | 0 |
| MySQL Fase 0 | 25 | 0 | 0 |
| MySQL HU13 | 27 | 0 | 0 |
| MySQL HU14 | 74 | 0 | 0 |
| MySQL HU15 | 54 | 0 | 0 |
| Funcionales generales HTTP | 12 | 0 | 0 |
| HTTP HU14, incluidos en sus 74 | 4 | 0 | 0 |
| HTTP HU15, incluidos en sus 54 | 5 | 0 | 0 |
| Frontend, 39 archivos | 121 | 0 | 0 |

Build frontend: exit 0, 2377 módulos; advertencia de Vite por un bundle superior a 500 kB. API del build: http://127.0.0.1:3100.

En HU15 se probaron los 17 requisitos obligatorios y además: catálogo de motivos maliciosos, legacy incompleto, correlación dual, pérdida de respuesta, cantidades obsoletas, mínimo Q5, FK/CHECK, resultado de checkout paid sin PAGO desde GET, rollback de registro de intento y rollback al reservar sucesor.

Casos numéricos: cuota Q100 + recargos Q15, tras rechazo/cancelación mantiene Q115 (capital Q100, recargos Q15). Abono confirmado Q50 fuera del período deja Q65, recargos Q0; un sucesor tras expired autoriza 6500 centavos. Q115 ya abonados bloquean nuevo cobro. Q120 abonados detectan sobrepago Q5. Q111 abonados dejan Q4 y bloquean el mínimo.

Las primeras corridas encontraron dos supuestos desactualizados de infraestructura TEST, corregidos sin cambiar el comportamiento financiero del proyecto:
1. El destino de restore reutilizado conservaba versiones antiguas de filas porque el respaldo hace ON DUPLICATE KEY UPDATE únicamente de la PK. La prueba ahora usa un destino TEST nuevo y vacío por ejecución, conserva los anteriores y prueba todas las columnas nuevas.
2. El test del seed HU13 asumía que la cuota manual no tenía pagos. Ahora compara el historial completo antes/después del seed repetido, preservando el pago real ya validado.

No se alteró la semántica de backup/restore en producción. Destino de restauración de la corrida aprobada: nexus_phase0_test_20261001_a9a8f83b_restore_ff267d62; se conserva para inspección.

Comandos utilizados:
```powershell
$env:RUN_PHASE0_MYSQL_TESTS='1'
$env:PHASE0_TEST_DATABASE='nexus_phase0_test_20261001_a9a8f83b'
$env:PHASE0_TEST_PORT='20378'
# Backend completo: aislar DB y vaciar credenciales antes de importar app/DB.
@'
require('./test/integration/support/isolatedMysql').configureTestEnvironment();
const { spawnSync } = require('node:child_process');
process.exitCode = spawnSync('cmd.exe', ['/d','/s','/c','npm.cmd test'],
  { stdio: 'inherit', windowsHide: true }).status;
'@ | node -
npm.cmd run test:phase0:mysql
npm.cmd run test:hu13:mysql
npm.cmd run test:hu14:mysql
npm.cmd run test:hu15:mysql
npm.cmd run test:phase0:functional
# Frontend, desde frontend/
npm.cmd run test:run
$env:VITE_API_URL='http://127.0.0.1:3100'
npm.cmd run build
```

## 17. Compatibilidad y preservación de HU13/HU14

HU13/HU14 pasan sus suites completas. Auditoría de los registros reales comparados con el inventario anterior a HU15: sin cambios. Cuota 171 PAGADA, saldo Q0.00, PAGO 395 Q5.00, transacción 296 CONFIRMADA, checkout 433 CONFIRMADO/paid. Eventos 348/349 mantienen estados e intentos originales; no se realizaron replays.

## 18–19. Restricciones y revisión Git

La base normal no fue consultada ni modificada. No se leyeron ni mostraron valores de Secret Key o signing secret, ni se copiaron a fixtures. Los tests configuraron credenciales ficticias o vacías antes de cargar la aplicación. No se modificó .env ni se instaló software. No hubo llamadas reales a la API de Recurrente, nuevos checkouts/pagos Sandbox, tarjetas, replays, webhooks registrados, cambios de ngrok, commits, push, merge ni ramas nuevas.

git diff --check: OK. Staging vacío; ningún .env seguido por Git. Escaneo de archivos de código/documentación, excluyendo .env y dependencias: sin patrones de credenciales reales encontrados.

git diff --stat acumulado: 46 archivos, 477 inserciones, 224 eliminaciones. Incluye los cambios anteriores a HU15; Git no incluye los archivos sin seguimiento en ese stat. Esta HU tiene 11 archivos creados y 24 modificados respecto al inventario inicial, con 0 eliminados.

## 20. Prueba manual recomendada — todavía NO realizada

Después de autorización, preparar una cuota TEST nueva y claramente identificable de Q5, del residente TEST; no reutilizar la cuota 171 pagada ni fixtures internos de concurrencia. Reiniciar el backend TEST con start:hu14:sandbox (que ahora incluye 004), manteniendo 127.0.0.1:3100, la base aislada, el mismo .env y el webhook/ngrok ya existentes. No registrar otro webhook.

1. El usuario abre http://127.0.0.1:5174/login y crea un checkout Sandbox desde Pagar para esa cuota.
2. El usuario utiliza únicamente la tarjeta de rechazo indicada en la documentación oficial Sandbox, después de autorizar expresamente esa prueba.
3. Esperar la entrega natural de Recurrente/Svix, sin replay automático. Verificar firma, Sandbox y HTTP 200. EVENTO registra el rechazo y su motivo; TRANSACCION FALLIDA si el contrato permite correlación canónica confiable. Con legacy mínimo, la evidencia queda en EVENTO y no se inventa una transacción.
4. Resultado financiero esperado: cero PAGO para ese intento, cuota pendiente, saldo Q5.00 sin variación, checkout no marcado CONFIRMADO por el rechazo.
5. Si el checkout sigue unpaid, continuar el mismo ID/URL tras verificación backend, sin un segundo checkout. Paid/payment_in_progress bloquean uno nuevo. Solo expired verificado permite un nuevo ID, con saldo recalculado y sin operación bloqueante.
6. Probar abandono/retorno por cancel_url por separado: debe permanecer no completado/pendiente de verificación, sin afirmar CANCELADO financiero salvo evento autoritativo.
7. Una recuperación exitosa autorizada debe ser confirmada por HU14 una sola vez: un PAGO Q5 y saldo Q0. Si el contrato real trae campos nuevos o evidencia contradictoria, diagnosticar primero y no forzar estados.

El backend manual ya abierto no fue reiniciado ni se administró ngrok durante HU15; antes de esa futura prueba deberá cargar el código nuevo mediante un reinicio autorizado.

## Anexo: git diff --stat y git status --short acumulados

Incluye modificaciones preexistentes y archivos sin seguimiento; staging vacío.

```text
 proyecyo-1/.env.example                            |  5 ++
 proyecyo-1/backend/.env.example                    |  6 ++
 proyecyo-1/backend/package-lock.json               | 30 +++++++++-
 proyecyo-1/backend/package.json                    | 11 +++-
 proyecyo-1/backend/server.js                       |  8 ++-
 proyecyo-1/backend/sql/Dockerfile                  |  4 ++
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
 46 files changed, 477 insertions(+), 224 deletions(-)
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
?? backend/src/services/__tests__/recurrenteAttemptPayload.test.js
?? backend/src/services/__tests__/recurrenteCheckoutService.test.js
?? backend/src/services/__tests__/recurrenteCheckoutStatus.test.js
?? backend/src/services/__tests__/recurrenteClient.test.js
?? backend/src/services/__tests__/recurrenteWebhookPayload.test.js
?? backend/src/services/__tests__/surchargeBalance.test.js
?? backend/src/services/financialBalance.js
?? backend/src/services/recurrenteAttemptPayload.js
?? backend/src/services/recurrenteAttemptService.js
?? backend/src/services/recurrenteCheckoutErrors.js
?? backend/src/services/recurrenteCheckoutGuard.js
?? backend/src/services/recurrenteCheckoutService.js
?? backend/src/services/recurrenteCheckoutStatus.js
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
?? docs/recurrente-hu14-contrato-real.md
?? docs/recurrente-hu14.md
?? docs/recurrente-hu15.md
?? evidencias_sprint/
?? frontend/src/components/payments/
?? frontend/src/services/api.serialization.test.ts
?? frontend/src/services/recurrenteCheckoutService.test.ts
?? frontend/src/services/recurrenteCheckoutService.ts
?? frontend/src/types/financialBalance.ts
?? frontend/src/types/recurrenteCheckout.ts
?? frontend/src/views/ResidentePaymentReturnView.hu15.test.tsx
?? frontend/src/views/ResidentePaymentReturnView.test.tsx
?? frontend/src/views/ResidentePaymentReturnView.tsx
?? "../rt -uo"
```
