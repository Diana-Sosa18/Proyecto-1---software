# Cierre técnico de Fase 0 — MySQL aislado

Fecha: 2026-10-01. Proyecto: `C:\Users\VICTUS\Documents\olasoft\Proyecto-1---software\proyecyo-1`.

Resultado: migración, restricciones, concurrencia, rollback, cálculos financieros y backup/restore validados sobre MySQL real aislado. Las suites existentes y el build aprobaron. Este cierre utiliza las definiciones actuales del Sprint 9 y no implementa HU13–HU19.

## Motor e infraestructura utilizada

| Elemento | Valor comprobado |
| --- | --- |
| Motor Docker | 29.2.1; Docker Desktop activo |
| Imagen local reutilizada | `mysql:8.4`; no se instaló software ni se descargó otra imagen |
| Versión MySQL | 8.4.8 |
| Contenedor exclusivo | `nexus-phase0-test-20261001-a9a8f83b` |
| Dirección publicada | `127.0.0.1:20378` |
| Base principal de pruebas | `nexus_phase0_test_20261001_a9a8f83b` |
| Base de restauración de pruebas | `nexus_phase0_test_20261001_a9a8f83b_restore` |
| Almacenamiento | Volumen anónimo exclusivo del contenedor; sin montar almacenamiento del proyecto o de la base normal |
| Tablas financieras | InnoDB |
| Aislamiento comprobado | REPEATABLE-READ |
| Zona horaria del contenedor | -06:00 |

Se creó el esquema del repositorio con datos TEST en la base vacía. El inicializador de pruebas elimina **en memoria** las instrucciones `CREATE DATABASE`, `USE nexus_residencial` y `DROP TABLE` de la semilla, y rechaza comandos destructivos antes de ejecutarla. No modifica `backend/sql/init.sql`. Si encuentra tablas existentes, conserva los fixtures y no reinicializa la base.

Los scripts nuevos exigen habilitación explícita, un nombre con formato `nexus_phase0_test_FECHA_IDENTIFICADOR` y un puerto exclusivo; rechazan el nombre normal y los puertos 3306, 3308 y 3318. No tienen valores de conexión por defecto. Antes de cargar la aplicación reemplazan la configuración de DB y dejan vacías las variables de Recurrente y del proveedor de correo. Esto tiene 15 pruebas unitarias.

El servidor funcional escucha en `127.0.0.1` con puerto HTTP efímero. Su runner asigna explícitamente `API_URL` a ese servidor; no utiliza el backend normal ni inicia `server.js` o sus schedulers.

Se inspeccionaron los contenedores normales solo en modo lectura. `nexus_backend` ejecuta `node server.js` y no monta los archivos locales editados; no tiene recarga de esos cambios. No se reinició, reconstruyó ni modificó ningún contenedor normal.

Las dos bases de pruebas, el contenedor y sus fixtures se conservan para revisión. No se eliminó ningún contenedor, volumen ni dato existente.

## Migración aplicada y conservación del esquema

Migración real: `backend/sql/migrations/001_recurrente_preparation.sql`.
Ejecutor existente: `backend/src/database/recurrenteMigration.js`.

Se aplicó sobre el esquema del repositorio y se repitió dos veces dentro de la prueba de idempotencia, además de las ejecuciones de preparación de las suites. Todas las ejecuciones terminaron correctamente.

La prueba compara las filas completas antes y después en `USUARIO`, `RESIDENTE`, `CASA`, `CUOTA`, `PAGO` y `TRANSACCION_SIMULADA`. No cambiaron. La aplicación inicial también conservó el pago previamente sembrado. El backfill clasifica los pagos históricos como `HISTORICO/historical` y los simulados como `SIMULADO/academic`, sin alterar sus montos ni inventar operaciones del proveedor.

No hay `DROP TABLE` en la migración. Se crean cinco tablas y dos índices adicionales: `uq_cuota_casa_recurrente(id_cuota,id_casa)` y `uq_pago_cuota_recurrente(id_pago,id_cuota)`. La creación de índices consulta `information_schema`; las tablas usan `IF NOT EXISTS` y el backfill añade únicamente orígenes ausentes. El ejecutor usa una conexión dedicada y un bloqueo de migración.

MySQL hace commits implícitos del DDL: la seguridad comprobada es que esta preparación puede repetirse, no una transacción global reversible de toda la migración. Las comprobaciones usaron el esquema del repositorio y datos TEST preexistentes, sin copiar ni consultar datos de la base normal.

| Tabla nueva comprobada en information_schema | PK | UNIQUE | FK | CHECK |
| --- | ---: | ---: | ---: | ---: |
| PAGO_ORIGEN | 1 | 1 | 1 | 1 |
| CHECKOUT_RECURRENTE | 1 | 4 | 4 | 5 |
| TRANSACCION_RECURRENTE | 1 | 4 | 2 | 4 |
| EVENTO_RECURRENTE | 1 | 1 | 0 | 2 |
| REEMBOLSO_RECURRENTE | 1 | 2 | 2 | 4 |

`EVENTO_RECURRENTE` conserva identificadores externos y el hash del cuerpo; su diseño no exige una FK local a una transacción ya existente. Se verificó también `idx_evento_reintento(estado,proximo_reintento_en)` y los índices de soporte de FK.

## Restricciones e idempotencia

Todas las siguientes comprobaciones aprobaron con INSERTs TEST y errores reales de MySQL:

| Restricción | Resultado individual |
| --- | --- |
| Checkout: `uq_checkout_referencia` | Repetir referencia local produce ER_DUP_ENTRY |
| Checkout: `uq_checkout_externo`, `uq_checkout_idempotencia` | Externo y clave únicos por ambiente; se admiten en otro ambiente |
| Transacción: `uq_transaccion_externo`, `uq_transaccion_idempotencia` | Duplicados rechazados por ambiente |
| Transacción: `uq_transaccion_pago` | Un mismo abono contable no puede vincularse a dos transacciones |
| Origen del pago: PK `id_pago` | No puede clasificarse dos veces el mismo pago |
| Evento: `uq_evento_svix_ambiente(ambiente,svix_id)` | Mismo svix-id y ambiente rechazado; otro ambiente permitido |
| Identificadores binarios | svix-id conserva distinción de mayúsculas/minúsculas |
| Reembolso: `uq_reembolso_externo`, `uq_reembolso_idempotencia` | Duplicados rechazados por ambiente; fixtures PARCIAL y TOTAL admitidos |
| FK cuota/casa y usuario | Referencias inexistentes o inconsistentes rechazadas |
| FK compuesta checkout/transacción | No permite cambiar cuota, casa, usuario, ambiente o moneda |
| FK compuesta transacción/PAGO_ORIGEN | No admite abonos académicos, de otra cuota ni de un ambiente distinto |
| FK compuesta reembolso/transacción | Rechaza ambiente o moneda inconsistentes |
| CHECK de clasificación | HISTORICO/production rechazado |
| CHECK monetarios | Checkout de cero, negativo, moneda inválida o desglose que no suma rechazado |

Los valores `sandbox` y `production` usados para comprobar unicidad son columnas de fixtures dentro de la base de pruebas; no representan conexiones o pagos reales.

`CUOTA.monto`, `PAGO.monto_pagado` y `RECARGO_APLICADO.monto_recargo` conservan `DECIMAL(10,2)`. Los tres registros de operaciones futuras utilizan `BIGINT UNSIGNED` para centavos. El checkout exige que monto = capital + recargo, y un importe positivo dentro del rango entero seguro del diseño. La moneda se conserva explícitamente como `CHAR(3)`; se probaron GTQ y rechazo de vínculos con moneda diferente. No se tomó ninguna decisión de conversión monetaria.

## Concurrencia y rollback

Archivo: `backend/test/integration/phase0.mysql.test.js`. Cada escenario siguiente aprobó individualmente.

| Escenario | Resultado observado |
| --- | --- |
| Dos llamadas simultáneas al servicio existente de pago simulado sobre una cuota | Una aprobada, otra HTTP 409; exactamente un PAGO y saldo Q0 |
| Dos conexiones insertando el mismo svix-id/ambiente | Una inserción, un ER_DUP_ENTRY; exactamente un evento |
| Dos procesos Node separados confirmando la misma transacción TEST | Una aplicación, un resultado idempotente; ambos devuelven el mismo id_pago; un PAGO y saldo Q0 |
| Abonos concurrentes Q10 + Q50 sobre Q100 + Q15 | Total abonado Q60; recargos pendientes Q0; capital y saldo Q55 |
| Abonos concurrentes Q80 + Q80 sobre Q115 | Uno aceptado y otro HTTP 409; abonado Q80; saldo Q35 |
| Fallo deliberado después de INSERT PAGO en confirmación TEST | Rollback: sin PAGO/origen y transacción PENDIENTE; dos reintentos terminan con un único abono |
| Fallo SQL real en PAGO_ORIGEN durante pago simulado | CHECK rechaza SIMULADO/production; PAGO, TRANSACCION_SIMULADA y PAGO_ORIGEN revierten; saldo Q115 |
| Restore con referencia huérfana después de una primera inserción válida | Restore rechazado; rollback elimina únicamente la inserción no confirmada del fixture; FOREIGN_KEY_CHECKS vuelve a 1 |

La concurrencia utiliza conexiones diferentes, bloqueos `FOR UPDATE` y transacciones SQL reales. La confirmación de transacciones futuras existe **exclusivamente como fixture bajo test/integration/support**; no se añadió un servicio, ruta, cliente de API o procesador de webhooks de producción. La prueba comprueba el patrón de bloqueo e integridad para la futura implementación; no confirma autenticidad de eventos ni sustituye HU14.

No se observaron doble abono ni saldos negativos.

## Reglas financieras aprobadas

Se verificó la misma fuente de cálculo existente en `backend/src/services/financialBalance.js`, tanto en JS como mediante `QUOTA_BALANCES_SQL` sobre MySQL.

| Capital original | Recargo original | Abono confirmado | Recargo pendiente | Capital pendiente | Saldo | Exceso explícito |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Q100 | Q15 | Q10 | Q5 | Q100 | Q105 | Q0 |
| Q100 | Q15 | Q50 | Q0 | Q65 | Q65 | Q0 |
| Q100 | Q15 | Q115 | Q0 | Q0 | Q0 | Q0 |
| Q100 | Q15 | Q120 histórico TEST | Q0 | Q0 | Q0 | Q5 |
| Q0.30 | Q0.10 | Q0.20 | Q0 | Q0.20 | Q0.20 | Q0 |

En el sobrepago, el exceso Q5 queda identificado y un cobro adicional devuelve HTTP 409 con `FINANCIAL_OVERPAYMENT`. No se aplica el excedente a otra cuota ni se implementa una devolución automática.

La validación temporal usa agosto de 2026:

- Cuota Q100 + Q15 con Q100 pagados el 2025-02-01 y Q15 el 2026-08-15: saldo real Q0; el listado de agosto solo muestra Q15.
- Otra cuota Q100 + Q15 con Q115 pagados el 2025-02-01: saldo real Q0 y ningún movimiento de esa cuota en agosto.

Se verificaron estos resultados en detalle financiero de residente, cuenta de inquilino y movimientos del reporte mensual. También ejecutaron correctamente las consultas reales de estado de cuenta de residente, morosos administrativos, exportación de morosos y comprobante existente. Las suites unitarias completas cubren las demás vistas y servicios adaptados en Fase 0. No se redefinió ninguna otra política financiera.

## Cambios concretos en backup/restore

Archivos modificados en este cierre:

- `backend/src/services/automaticBackupsService.js`
- `backend/src/services/restoresService.js`
- `backend/package.json`: scripts de pruebas MySQL y funcionales aisladas.

Archivos nuevos:

- `backend/src/database/backupTables.js`
- `backend/src/services/__tests__/financialBackups.test.js`
- `backend/src/config/__tests__/isolatedMysql.test.js`
- `backend/scripts/test-phase0-functional.js`
- `backend/test/integration/phase0.mysql.test.js`
- `backend/test/integration/support/isolatedMysql.js`
- `backend/test/integration/support/initializeTestSchema.js`
- `backend/test/integration/support/financialFixtures.js`
- `backend/test/integration/support/confirmationWorker.js`
- `backend/test/integration/support/restoreWorker.js`
- Este informe: `docs/recurrente-fase0-validacion-mysql.md`.

El catálogo exporta ahora 23 tablas. Conserva las 13 anteriores y añade `SERVICIO`, `CASA_SERVICIO`, `INQUILINO_CASA`, `RECARGO_APLICADO`, `TRANSACCION_SIMULADA` y las cinco tablas nuevas de Fase 0. La lista de restauración conserva todas las tablas previamente autorizadas y añade recargos, transacciones simuladas y las cinco nuevas.

La generación usa una sola conexión con instantánea REPEATABLE READ consistente y de solo lectura. Conserva fechas y microsegundos mediante `dateStrings`, y falla si falta una tabla financiera necesaria o se produce un error de lectura. Mantiene compatibilidad con tablas antiguas opcionales ausentes.

La restauración sigue siendo de datos sobre un esquema previamente preparado. Conserva el comportamiento anterior de INSERT con no-op sobre registros duplicados; no se convirtió en una sustitución destructiva de datos existentes. Antes del commit ahora comprueba las FK afectadas, incluidas las compuestas: MySQL no valida retroactivamente las filas al reactivar FOREIGN_KEY_CHECKS. También rechaza destinos de sentencias calificados con otra base y sanitiza mensajes de error almacenados.

La prueba real exportó las 23 tablas, preparó el esquema de la base `_restore`, restauró mediante el servicio existente y comparó todas las filas y columnas exportadas con el origen, incluidas las cinco tablas, sus relaciones, montos y fechas con microsegundos. Aprobó también en ejecuciones repetidas sin limpiar las bases. El respaldo se manejó en memoria: no se ejecutó retención ni eliminación de respaldos anteriores.

Hay 11 pruebas Jest nuevas de backup/restore y 15 de aislamiento. No se agregaron dependencias.

## Resultados exactos de las pruebas y build

| Ejecución | Aprobadas | Fallidas | Omitidas |
| --- | ---: | ---: | ---: |
| Backend node:test de `npm.cmd test` | 93 | 0 | 0 |
| Backend Jest de `npm.cmd test` — 35 suites | 157 | 0 | 0 |
| MySQL real: `npm.cmd run test:phase0:mysql` | 25 | 0 | 0 |
| Funcionales HTTP: `npm.cmd run test:phase0:functional` | 12 | 0 | 0 |
| Frontend: `npm.cmd run test:run` — 36 archivos | 86 | 0 | 0 |

Backend estándar: **250 aprobadas, 0 fallidas, 0 omitidas**.
Backend incluyendo la suite SQL dedicada: **275 aprobadas, 0 fallidas, 0 omitidas**; las 12 funcionales se reportan por separado.
Total de las cinco filas: **373 pruebas aprobadas, 0 fallidas, 0 omitidas**. Las repeticiones de una misma suite no incrementan estos totales.

Las 12 funcionales existentes cubrieron sanciones administrativas, generación de sanciones, conflicto de reservas, detalle financiero y filtros/autorización, recordatorios/configuración/autorización y cuentas de residente e inquilino.

Build: `cd frontend; npm.cmd run build`, código de salida 0, 2375 módulos transformados. Bundle JS 1150.94 kB, gzip 322.50 kB. Continúa el aviso previo de chunks mayores de 500 kB; no impide el build y no se modificó la arquitectura del frontend en este cierre.

Para repetir las suites aisladas desde `backend` en PowerShell:

```powershell
$env:RUN_PHASE0_MYSQL_TESTS = '1'
$env:PHASE0_TEST_DATABASE = 'nexus_phase0_test_20261001_a9a8f83b'
$env:PHASE0_TEST_PORT = '20378'
npm.cmd run test:phase0:mysql
npm.cmd run test:phase0:functional
```

## Git, secretos y preservación de cambios

La comparación SHA-256 de los 100 archivos registrados al comenzar este cierre confirma 97 intactos y únicamente los tres archivos modificados arriba distintos; ninguno ausente. Los 36 archivos de cambios preexistentes ajenos a Fase 0 se conservan exactamente, incluidos AdminLayout, evidencias y `../rt -uo`.

No hay archivos `.env` reales en raíz/backend/frontend. Los ejemplos existentes conservan vacías las tres variables de Recurrente y no se modificaron en este cierre. La revisión de diff y archivos nuevos no encontró secretos reales; la búsqueda de patrones comunes tampoco produjo hallazgos. No hay esas variables o claves de proveedor en frontend/src ni en el build generado. Los fixtures solo usan identificadores TEST y configuración de pruebas. No se imprimieron secretos ni se consultaron los entornos de los contenedores normales.

`git diff --cached --name-only`: salida vacía. No se añadieron archivos a staging.
`git diff --check`: sin errores; Git avisa de normalización futura LF/CRLF en archivos previamente editados.

Las salidas siguientes corresponden al workspace completo, que incluye cambios de la Fase 0 anterior y cambios preexistentes. `git diff --stat` no incluye archivos nuevos sin seguimiento.

### git diff --stat

```text
 proyecyo-1/.env.example                            |  5 ++
 proyecyo-1/backend/.env.example                    |  5 ++
 proyecyo-1/backend/package.json                    |  3 +
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
 .../src/services/automaticBackupsService.js        | 38 ++++++++----
 .../backend/src/services/financialRulesService.js  |  8 ++-
 .../backend/src/services/passwordResetService.js   |  3 +-
 .../backend/src/services/reportExportService.js    | 18 +++---
 .../backend/src/services/residentAccountService.js | 29 ++++------
 .../src/services/residentFinancialDetailService.js | 32 +++++------
 proyecyo-1/backend/src/services/restoresService.js | 42 +++++++++++++-
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
 43 files changed, 351 insertions(+), 160 deletions(-)
```

### git status --short

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
?? backend/src/database/backupTables.js
?? backend/src/database/recurrenteMigration.js
?? backend/src/middlewares/recurrenteRawBody.js
?? backend/src/services/__tests__/financialBackups.test.js
?? backend/src/services/__tests__/financialBalance.test.js
?? backend/src/services/__tests__/financialPeriods.test.js
?? backend/src/services/__tests__/surchargeBalance.test.js
?? backend/src/services/financialBalance.js
?? backend/src/utils/__tests__/safeLogger.test.js
?? backend/src/utils/safeLogger.js
?? backend/test/integration/
?? docs/recurrente-fase0-validacion-mysql.md
?? docs/recurrente-fase0.md
?? evidencias_sprint/
?? frontend/src/components/payments/
?? frontend/src/services/api.serialization.test.ts
?? frontend/src/types/financialBalance.ts
?? "../rt -uo"
```

## Confirmaciones y pendientes antes de HU13

- La base normal de NexusResidencial no fue consultada ni modificada por esta tarea. Todas las conexiones SQL y restauraciones efectivas utilizaron exclusivamente las dos bases de pruebas indicadas. No se eliminó ningún dato existente.
- No se llamó a Recurrente, no se usó RECURRENTE_SECRET_KEY, no se registraron webhooks y no se implementaron HU13–HU19.
- No se expusieron secretos reales. No hubo instalación de software, cambios de configuración del sistema, commit, push, merge, creación de ramas o staging.
- No quedan pendientes bloqueantes de la validación técnica de Fase 0 solicitada: migración, unicidad, FK, concurrencia, rollback, saldos y backup/restore aprobaron.
- La migración de la base normal queda sin aplicar por esta tarea, conforme a la restricción; su despliegue requerirá un paso separado autorizado y su respaldo correspondiente.
- La autenticidad Svix, cliente de checkout, confirmación por API/webhook, estados negativos, comprobantes reales, conciliación y reembolsos/notificaciones siguen reservados para las HU actuales del Sprint 9. Las pruebas de fixtures no sustituyen la futura prueba completa del proveedor. Cualquier nueva política financiera, en particular el efecto contable de un reembolso, requiere una decisión explícita antes de implementarse.
- El informe anterior `docs/recurrente-fase0.md` se conserva como registro de la primera implementación. Este documento actualiza el estado de sus pendientes de infraestructura y validación.
