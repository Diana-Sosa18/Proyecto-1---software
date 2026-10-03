# Recurrente — informe de Fase 0

Fecha de verificación: 2026-10-01. Proyecto: `Proyecto-1---software/proyecyo-1`.

La Fase 0 prepara la persistencia, los saldos, la configuración y la entrada HTTP. No realiza llamadas a Recurrente, no crea checkouts ni registra webhooks y no implementa las HU13–HU19 del Sprint 9. No se instalaron dependencias nuevas. La biblioteca oficial `svix` corresponde a la futura verificación de firmas, antes de activar el webhook.

## Reglas financieras implementadas

`backend/src/services/financialBalance.js` contiene una sola regla de aplicación: abonos confirmados primero a recargos, después a capital. La misma función de asignación genera la evaluación en centavos de JavaScript y las expresiones DECIMAL de SQL. Se usa en cuentas de residente/inquilino, detalle financiero, administración, reporte mensual, exportación de morosos, recordatorios y generación existente de recargos. El pago simulado calcula su importe exclusivamente en backend.

| Capital | Recargo | Abono | Capital pendiente | Recargo pendiente | Saldo |
| ---: | ---: | ---: | ---: | ---: | ---: |
| Q100 | Q15 | Q50 | Q65 | Q0 | Q65 |
| Q100 | Q15 | Q10 | Q100 | Q5 | Q105 |
| Q100 | Q15 | Q115 | Q0 | Q0 | Q0 |

Los saldos de las cuentas y del reporte mensual incluyen todos los abonos contables de cada cuota. Las fechas filtran las listas de movimientos, sin limitar las sumas acumuladas de pagos o recargos. El detalle financiero conserva `total_pagado` como acumulado y añade `total_pagado_periodo`. El reporte mensual conserva métricas de ingresos del mes mediante una consulta independiente de movimientos; `cantidad_pagos` cuenta abonos, en vez de cuotas con algún pago. Las cuotas y su deuda actual se consultan completas. Los filtros administrativos de unidad, estado y vencimiento se mantienen; sus saldos utilizan igualmente todos los abonos. La exportación de morosos muestra todas las cuotas vencidas con deuda actual: el rango de fechas de movimientos no oculta cuotas ni limita abonos. El PDF/XLSX lo explica en sus metadatos.

Las respuestas añaden `capital_pendiente`, `recargo_pendiente`, `sobrepago` y `requiere_revision` donde corresponden. Un sobrepago deja saldo cero y se muestra para revisión; no se traslada a otra cuota, no se elimina del historial ni se transforma en deuda negativa. Un intento adicional de cobro de esa cuota obtiene HTTP 409 con `FINANCIAL_OVERPAYMENT`. No se decidió ninguna política nueva de devolución o aplicación de excedentes.

Los pagos simulados bloquean la cuota antes de leer los abonos acumulados y registran su origen académico en la misma transacción SQL que `PAGO` y `TRANSACCION_SIMULADA`. Cualquier fallo revierte las tres escrituras. La autenticación y autorización existentes se conservan.

## Correcciones preexistentes

- Doble serialización: los dos servicios de pago del frontend envían objetos; `apiRequest` serializa una vez y mantiene compatibilidad con JSON previamente serializado.
- El detalle financiero ya no obtiene saldo restando únicamente los movimientos del período.
- Administración ya no vuelve a sumar recargos que un abono cubrió ni marca pagada una cuota que aún debe recargos.
- Reportes, exportaciones y recordatorios usan la misma asignación de recargos/capital.
- Los sobrepagos dejan de ocultarse mediante un simple truncamiento a cero.
- El flujo simulado lee el agregado de abonos después de obtener el bloqueo de la cuota.
- Las excepciones pasan por sanitización reutilizable: claves sensibles, Authorization, buffers, datos de tarjeta en texto, credenciales URL y secretos configurados. No se imprimen request/response/config/stack arbitrarios de excepciones.

## Persistencia aditiva

Archivo: `backend/sql/migrations/001_recurrente_preparation.sql`. Destino: MySQL 8.4, como el Dockerfile existente. No contiene DROP TABLE, borrado de datos ni cambios de montos históricos.

| Tabla nueva | Propósito |
| --- | --- |
| `PAGO_ORIGEN` | Identifica cada abono como HISTORICO/historical, SIMULADO/academic o RECURRENTE/sandbox–production; vincula el abono con su cuota. |
| `CHECKOUT_RECURRENTE` | Referencia local, ID externo, idempotencia, cuota, usuario, residente opcional y casa; importe/capital/recargo en centavos, moneda, ambiente, estado y fechas. |
| `TRANSACCION_RECURRENTE` | Operación externa y su checkout, importe, ambiente, estado y vínculo opcional al abono aplicado en PAGO; unicidad de operación, idempotencia y abono. |
| `EVENTO_RECURRENTE` | Unicidad de svix-id por ambiente, tipo de evento, operación externa, hash del body, procesamiento, intentos, error sanitizado y próximo reintento. |
| `REEMBOLSO_RECURRENTE` | Solicitud parcial/total, importe, moneda, ambiente, usuario administrativo, ID externo, idempotencia, estado, error y fechas. |

Se añaden dos índices únicos a tablas existentes, sin modificar filas: `CUOTA(id_cuota,id_casa)` y `PAGO(id_pago,id_cuota)`. Su creación consulta information_schema y puede repetirse. Las claves foráneas compuestas impiden vincular un checkout a una casa distinta de la cuota, cambiar la cuota/casa/usuario/moneda/ambiente entre checkout y transacción, o vincular una transacción real a un abono académico/histórico o de otra cuota. Los identificadores externos y svix-id usan comparación binaria.

La clasificación inicial consulta `TRANSACCION_SIMULADA`: sus abonos se etiquetan SIMULADO; los demás existentes se etiquetan HISTORICO. No se inventan IDs del proveedor ni se convierten pagos históricos en transacciones reales. PAGO continúa siendo el registro de abonos contables aplicados; las tablas de intentos no modifican saldos.

Los eventos almacenan metadatos mínimos y un hash; no existe columna de raw body, payload JSON ni datos completos de tarjeta. La verificación futura utilizará el buffer en memoria. La persistencia del importe de un reembolso no sustituye la futura validación, bajo bloqueo, del total acumulado de reembolsos elegibles.

### Aplicación

- Instalación existente: desde `backend/`, `npm run migrate:recurrente`. El script asegura primero la tabla simulada existente y utiliza una conexión dedicada con bloqueo de migración.
- Inicio normal: `backend/server.js` aplica la misma migración después de asegurar el esquema simulado.
- Instalación nueva en Docker: `backend/sql/Dockerfile` copia la migración como `z001_recurrente_preparation.sql`, después de `init.sql`.
- `backend/sql/init.sql` se dejó intacto. No debe usarse para actualizar una base existente.
- MySQL hace commits implícitos de DDL. La migración puede reintentarse tras una ejecución parcial; no promete atomicidad global del DDL.
- **No se aplicó a ninguna base durante esta tarea.** Su SQL y su ejecutor tienen pruebas estáticas/con mocks. Falta comprobar el DDL, las FK, el backfill y las consultas financieras sobre un MySQL real aislado.

## Configuración, HTTP y seguridad

Las tres variables `RECURRENTE_SECRET_KEY`, `RECURRENTE_WEBHOOK_SECRET` y `RECURRENTE_SANDBOX_ID` tienen valores vacíos en los ejemplos. Docker Compose las entrega exclusivamente al backend en tiempo de ejecución. No son argumentos de build ni variables VITE. Son opcionales en Fase 0 y su presencia nunca habilita una llamada o cobro. La configuración oculta esos campos de la serialización enumerable.

`createApp({ recurrenteWebhookHandler })` ofrece un punto de montaje opcional para POST `/webhooks/recurrente`, antes de `express.json()`. Conserva `req.rawBody` como Buffer original, limita a 1 MB y rechaza cuerpos comprimidos y tipos diferentes de application/json. Sin handler, el servidor actual responde 404: no hay procesamiento financiero ni verificación Svix todavía. Las pruebas demuestran conservación de espacios, Unicode, CRLF y números con decimales escritos explícitamente, además del funcionamiento de JSON normal y de las restricciones de acceso.

Los archivos .gitignore/.dockerignore cubren entornos y credenciales tanto en raíz como en directorios anidados. Los ejemplos siguen disponibles en Git. No se modificó ningún .env real; no hay archivos staged ni .env reales bajo seguimiento. La revisión del diff y archivos nuevos no encontró valores reales de secretos ni referencias a esas variables en frontend/src o en el build generado. Esta revisión combina lectura del diff y búsqueda de patrones; no sustituye un escáner de secretos en CI.

## Pruebas y build

| Comando | Resultado final |
| --- | --- |
| `cd backend; npm test` | 93 pruebas node:test aprobadas, 0 fallos, 0 omitidas; 33 suites Jest y 131 pruebas aprobadas, 0 fallos. **224 pruebas backend aprobadas.** |
| `cd frontend; npm run test:run` | 36 archivos, **86 pruebas aprobadas**, 0 fallos. |
| `cd frontend; npm run build` | Exit 0. Vite 6.3.5, 2375 módulos, build en 37.02 s. |
| `cd backend; npm run test:functional` | 12 pruebas omitidas, 0 ejecutadas, 0 fallos: requieren servidor y DB activos; se mantuvo RUN_FUNCTIONAL_TESTS=0. |
| `docker compose config --quiet` | Exit 0. Configuración Compose válida, sin imprimir variables. |
| `git diff --check` | Exit 0, sin problemas de whitespace. |

Build: index.html 1.03 kB, CSS 62.63 kB, JavaScript 1150.94 kB (gzip 322.50 kB). Advertencia de chunk mayor a 500 kB; no impide el build.

La base previa a los cambios pasó 93 + 89 pruebas backend y 76 frontend. Se añadieron 42 pruebas backend y 10 frontend. Se cubren los casos financieros aprobados, sobrepagos sin compensación entre cuotas, períodos sin movimientos, pagos/recibos/administración y autenticación existentes, serialización, configuración, protección Git/Docker, montaje HTTP, logs y migración.

En la primera ejecución modificada hubo dos fallos, corregidos: Superagent serializaba el Buffer de prueba en lugar de enviarlo literalmente, y una aserción de recordatorios exigía la fórmula SQL anterior. La ejecución final no presenta fallos. La restricción inicial del sandbox para crear procesos de pruebas (EPERM) se resolvió ejecutando los comandos autorizados con elevación revisada automáticamente.

Docker CLI está disponible, pero `docker info` falla porque no existe el pipe dockerDesktopLinuxEngine. Por eso no se ejecutó una base MySQL de prueba ni las pruebas funcionales contra el servidor.

## Control de cambios

Antes de editar se registraron `frontend/src/components/admin/AdminLayout.tsx`, `evidencias_sprint/` y `../rt -uo`. Se verificaron por SHA-256 los 36 archivos preexistentes: ninguno cambió. AdminLayout sigue figurando modificado únicamente por su cambio previo. No se crearon ramas ni se hicieron commits, push, merge o staging.

Hay 40 archivos existentes modificados por esta fase y 23 creados, incluyendo este informe. El stat convencional de Git incluye el cambio previo de AdminLayout y excluye los archivos aún sin seguimiento.

### Archivos creados

- `.gitignore`
- `backend/.dockerignore`
- `backend/scripts/migrate-recurrente.js`
- `backend/sql/.dockerignore`
- `backend/sql/migrations/001_recurrente_preparation.sql`
- `backend/src/__tests__/recurrenteRawBody.test.js`
- `backend/src/config/__tests__/recurrente.test.js`
- `backend/src/config/__tests__/secretProtection.test.js`
- `backend/src/config/recurrente.js`
- `backend/src/database/__tests__/recurrenteMigration.test.js`
- `backend/src/database/recurrenteMigration.js`
- `backend/src/middlewares/recurrenteRawBody.js`
- `backend/src/services/__tests__/financialBalance.test.js`
- `backend/src/services/__tests__/financialPeriods.test.js`
- `backend/src/services/__tests__/surchargeBalance.test.js`
- `backend/src/services/financialBalance.js`
- `backend/src/utils/__tests__/safeLogger.test.js`
- `backend/src/utils/safeLogger.js`
- `frontend/src/components/payments/FinancialReviewNotice.test.tsx`
- `frontend/src/components/payments/FinancialReviewNotice.tsx`
- `frontend/src/services/api.serialization.test.ts`
- `frontend/src/types/financialBalance.ts`
- `docs/recurrente-fase0.md`

### Archivos modificados por Fase 0

- `.env.example`
- `backend/.env.example`
- `backend/package.json`
- `backend/server.js`
- `backend/sql/Dockerfile`
- `backend/src/app.js`
- `backend/src/config/env.js`
- `backend/src/database/mysql.js`
- `backend/src/services/__tests__/adminPaymentsService.test.js`
- `backend/src/services/__tests__/paymentRemindersRecipients.test.js`
- `backend/src/services/__tests__/simulatedPaymentsService.test.js`
- `backend/src/services/adminPaymentsService.js`
- `backend/src/services/adminRemindersService.js`
- `backend/src/services/financialRulesService.js`
- `backend/src/services/passwordResetService.js`
- `backend/src/services/reportExportService.js`
- `backend/src/services/residentAccountService.js`
- `backend/src/services/residentFinancialDetailService.js`
- `backend/src/services/simulatedPaymentsService.js`
- `backend/src/services/tenantAccountService.js`
- `backend/src/services/visitsService.js`
- `backend/test/detalleFinanciero.test.js`
- `backend/test/reportExport.test.js`
- `backend/test/residentAccount.test.js`
- `backend/test/tenantAccount.test.js`
- `docker-compose.yml`
- `frontend/.dockerignore`
- `frontend/src/services/accountService.ts`
- `frontend/src/services/api.ts`
- `frontend/src/services/tenantAccountService.ts`
- `frontend/src/types/account.ts`
- `frontend/src/types/financialDetail.ts`
- `frontend/src/types/payments.ts`
- `frontend/src/types/tenantAccount.ts`
- `frontend/src/views/AdminMonthlyFinancialReportView.test.tsx`
- `frontend/src/views/AdminMonthlyFinancialReportView.tsx`
- `frontend/src/views/AdminPaymentsView.tsx`
- `frontend/src/views/InquilinoAccountView.tsx`
- `frontend/src/views/ResidenteAccountView.tsx`
- `frontend/src/views/ResidenteFinancialDetailView.tsx`

### Git

El detalle literal de `git diff --stat` y `git status --short` aparece al final de este informe. El staging está vacío.

## Pendientes antes de HU13

1. Ejecutar la migración dos veces en una copia aislada de MySQL 8.4; comprobar conservación de datos, clasificación, unicidad de svix-id por ambiente, todas las FK y las consultas SQL financieras. No habilitar cobros hasta completar esa verificación.
2. Verificar el comportamiento concurrente con MySQL real: el bloqueo y lectura posterior están preparados y probados con mocks, no mediante dos sesiones SQL reales.
3. Aislar Sandbox y producción operativamente, preferiblemente con bases separadas. Las tablas reales distinguen ambientes; los estados de cuenta actuales conservan los abonos históricos/académicos existentes. Nunca introducir un abono de prueba en la deuda de producción.
4. Ampliar y verificar respaldos/restauraciones para la nueva metadata antes de guardar operaciones reales. `automaticBackupsService.js` tiene una lista de tablas que todavía no incluye las cinco nuevas y omite otras financieras existentes; `restoresService.js` desactiva temporalmente FK y no garantiza una restauración coherente de metadata del proveedor. Ese subsistema preexistente requiere revisión antes de usar dinero real.
5. HU13: implementar cliente HTTP del backend, permisos, importe obtenido del saldo común bajo bloqueo, referencia local aleatoria y validación completa de usuario/residente/casa/cuota. Ningún valor enviado por el frontend será el importe definitivo.
6. HU14: instalar la biblioteca oficial Svix, verificar firma sobre req.rawBody y confirmar mediante proveedor/API/webhook. Rechazar eventos sin firma válida, controlar idempotencia por ambiente + svix-id y aplicar transacción/PAGO/origen de forma atómica. El retorno del navegador no confirma el pago.
7. HU15–HU19 continúan pendientes según las definiciones actuales del Sprint 9: resultados negativos/reintentos seguros, comprobantes reales, conciliación, reembolsos/anulaciones y notificaciones. Reutilizar los servicios existentes donde corresponda, sin adoptar numeraciones históricas de documentos. Las reglas de elegibilidad y efecto contable de un reembolso necesitarán una decisión explícita antes de implementarse.
8. Revisar etiquetas de comprobantes y listados académicos al activar pagos reales; `paymentReceiptService.js` y los listados recientes actuales aún corresponden al flujo histórico/simulado.
9. La cuenta residente excluye alquiler; el detalle financiero incluye todas las cuotas de su casa y el inquilino incluye alquiler. Se preservó esa selección de conceptos por rol, distinta de la regla común de saldo. Ambos servicios de detalle/inquilino eligen una casa con LIMIT 1; no se amplió a multicasa en esta fase.

## Salidas finales de Git

`git diff --stat`:

```text
 proyecyo-1/.env.example                            |  5 ++
 proyecyo-1/backend/.env.example                    |  5 ++
 proyecyo-1/backend/package.json                    |  1 +
 proyecyo-1/backend/server.js                       |  8 ++-
 proyecyo-1/backend/sql/Dockerfile                  |  1 +
 proyecyo-1/backend/src/app.js                      | 11 ++--
 proyecyo-1/backend/src/config/env.js               |  3 +
 proyecyo-1/backend/src/database/mysql.js           |  5 +-
 .../__tests__/adminPaymentsService.test.js         |  1 +
 .../__tests__/paymentRemindersRecipients.test.js   |  3 +-
 .../__tests__/simulatedPaymentsService.test.js     | 43 ++++++++++++--
 .../backend/src/services/adminPaymentsService.js   | 67 +++++++++++++---------
 .../backend/src/services/adminRemindersService.js  | 17 +++---
 .../backend/src/services/financialRulesService.js  |  8 ++-
 .../backend/src/services/passwordResetService.js   |  3 +-
 .../backend/src/services/reportExportService.js    | 18 +++---
 .../backend/src/services/residentAccountService.js | 29 ++++------
 .../src/services/residentFinancialDetailService.js | 32 +++++------
 .../src/services/simulatedPaymentsService.js       | 23 ++++++--
 .../backend/src/services/tenantAccountService.js   | 33 +++++------
 proyecyo-1/backend/src/services/visitsService.js   |  5 +-
 proyecyo-1/backend/test/detalleFinanciero.test.js  |  1 +
 proyecyo-1/backend/test/reportExport.test.js       | 10 ++--
 proyecyo-1/backend/test/residentAccount.test.js    |  1 +
 proyecyo-1/backend/test/tenantAccount.test.js      |  1 +
 proyecyo-1/docker-compose.yml                      |  3 +
 proyecyo-1/frontend/.dockerignore                  | 21 +++++++
 .../frontend/src/components/admin/AdminLayout.tsx  |  5 ++
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
 .../frontend/src/views/ResidenteAccountView.tsx    |  2 +
 .../src/views/ResidenteFinancialDetailView.tsx     |  5 +-
 41 files changed, 284 insertions(+), 145 deletions(-)
```

`git status --short`:

```text
 M .env.example
 M backend/.env.example
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
 M backend/src/services/financialRulesService.js
 M backend/src/services/passwordResetService.js
 M backend/src/services/reportExportService.js
 M backend/src/services/residentAccountService.js
 M backend/src/services/residentFinancialDetailService.js
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
?? backend/src/database/__tests__/
?? backend/src/database/recurrenteMigration.js
?? backend/src/middlewares/recurrenteRawBody.js
?? backend/src/services/__tests__/financialBalance.test.js
?? backend/src/services/__tests__/financialPeriods.test.js
?? backend/src/services/__tests__/surchargeBalance.test.js
?? backend/src/services/financialBalance.js
?? backend/src/utils/__tests__/safeLogger.test.js
?? backend/src/utils/safeLogger.js
?? docs/recurrente-fase0.md
?? evidencias_sprint/
?? frontend/src/components/payments/
?? frontend/src/services/api.serialization.test.ts
?? frontend/src/types/financialBalance.ts
?? "../rt -uo"
```

`git diff --cached --name-only`: sin salida (staging vacío).
