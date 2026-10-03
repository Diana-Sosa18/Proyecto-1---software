# HU13 — Checkout hospedado Recurrente, exclusivamente Sandbox

Implementación y validación con mocks terminadas. La prueba contra el Sandbox del usuario queda pendiente de su autorización y ejecución local. El alcance corresponde a HU13 del Sprint 9 aprobado por el usuario.

**1. Archivos creados y modificados**

Rutas relativas a `C:\Users\VICTUS\Documents\olasoft\Proyecto-1---software\proyecyo-1`.

Creados en HU13 (22):

- `backend/scripts/start-hu13-sandbox.js`
- `backend/sql/migrations/002_recurrente_checkout.sql`
- `backend/src/config/recurrenteCheckout.js`
- `backend/src/config/__tests__/hu13ManualEnvironment.test.js`
- `backend/src/controllers/recurrenteCheckoutController.js`
- `backend/src/middlewares/requireResidentSession.js`
- `backend/src/routes/recurrenteCheckoutRoutes.js`
- `backend/src/services/recurrenteCheckoutErrors.js`
- `backend/src/services/recurrenteCheckoutGuard.js`
- `backend/src/services/recurrenteCheckoutService.js`
- `backend/src/services/recurrenteClient.js`
- `backend/src/services/__tests__/recurrenteCheckoutService.test.js`
- `backend/src/services/__tests__/recurrenteClient.test.js`
- `backend/src/utils/recurrenteCheckoutUrl.js`
- `backend/src/__tests__/recurrenteCheckout.routes.test.js`
- `backend/test/integration/hu13.mysql.test.js`
- `frontend/src/services/recurrenteCheckoutService.test.ts`
- `frontend/src/services/recurrenteCheckoutService.ts`
- `frontend/src/types/recurrenteCheckout.ts`
- `frontend/src/views/ResidentePaymentReturnView.test.tsx`
- `frontend/src/views/ResidentePaymentReturnView.tsx`
- `docs/recurrente-hu13.md`

Modificados respecto al estado recibido al iniciar HU13 (14):

- `backend/.env.example`
- `backend/package.json`
- `backend/scripts/migrate-recurrente.js`
- `backend/scripts/test-phase0-functional.js`
- `backend/server.js`
- `backend/sql/Dockerfile`
- `backend/src/app.js`
- `backend/src/database/recurrenteMigration.js`
- `backend/src/services/simulatedPaymentsService.js`
- `backend/src/services/__tests__/simulatedPaymentsService.test.js`
- `backend/test/integration/phase0.mysql.test.js`
- `frontend/src/routes/AppRouter.tsx`
- `frontend/src/views/ResidenteAccountView.payment.test.tsx`
- `frontend/src/views/ResidenteAccountView.tsx`

Los cambios previos de Fase 0 y del usuario permanecen. Se compararon hashes SHA-256 de los 422 archivos recibidos: únicamente cambiaron los 14 archivos enumerados; ninguno fue eliminado. Los 36 archivos originales previamente identificados, incluidos AdminLayout, evidencias_sprint y el archivo externo `../rt -uo`, conservan sus hashes. No se crearon ramas ni se realizaron commits, push o merge.

**2. Endpoints y contrato**

- Nuevo backend: `POST /residente/pagos/recurrente/checkout`.
- Body aceptado: `{"id_cuota":3}`. Cualquier campo adicional se rechaza; el identificador debe ser un entero positivo válido.
- Autenticación: Bearer firmado, sesión activa en SESION_ACTIVA y usuario activo con rol actual residente. Esta ruta no acepta el mecanismo histórico x-user-id/x-user-role, tampoco en tests.
- Respuesta 201: exclusivamente `referencia_local` y `checkout_url`.
- Nueva ruta frontend protegida: `/residente/pagos/retorno`.
- Los endpoints académicos `/residente/pagos-simulados` y `/inquilino/pagos-simulados` conservan su funcionalidad para cuotas habilitadas. Su backend bloquea una cuota con checkout CREADO, PENDIENTE o INCIERTO.

El payload se contrastó con [Crear checkout](https://docs.recurrente.com/referencia-api/api-reference/checkouts/create-checkout): items con name, amount_in_cents, currency GTQ y quantity 1, referencia local UUID como única metadata y success_url/cancel_url hacia la ruta de retorno. No se envía un header de idempotencia inventado; la reserva e idempotencia son locales.

[Obtener checkout](https://docs.recurrente.com/referencia-api/api-reference/checkouts/get-checkout) documenta GET /api/checkouts/:id sin checkout_url. Al reutilizar se conserva la URL validada y persistida en la creación, se verifica el mismo ID, estado unpaid, monto y moneda del proveedor. Si la consulta no permite verificar esa compatibilidad, la operación queda INCIERTO.

La [guía oficial de primer pago TEST](https://docs.recurrente.com/guias-espanol/comenzar/primer-pago-de-prueba) establece mínimo GTQ de 500 centavos y comprobación de environment y sandbox_id mediante GET /api/test. El cliente exige environment=sandbox e ID igual a RECURRENTE_SANDBOX_ID antes de cada POST o consulta de reutilización. No infiere el ambiente del prefijo de la llave.

**3. Flujo implementado**

1. Residente pulsa Pagar. El frontend envía solamente id_cuota, bloquea doble clic inmediatamente y muestra Abriendo checkout.
2. Backend usa la identidad de sesión, verifica rol y propiedad CUOTA → CASA → RESIDENTE → USUARIO.
3. Bloquea CUOTA con FOR UPDATE. Lee todos los abonos registrados y recargos sin filtro temporal y llama a calculateBalance/assertCollectible/toCents de Fase 0.
4. Rechaza cuota pagada, sobrepago histórico, importe inválido y saldo menor a Q5, sin crear checkout ni aumentar deuda.
5. Comprueba operaciones activas para esa cuota. Reutiliza únicamente una operación compatible de ese usuario/residente/casa, importe y distribución, GTQ, Sandbox e ID de Sandbox.
6. Para una nueva operación inserta y confirma la reserva local CREADO antes de contactar al proveedor.
7. Cliente verifica GET /api/test con credenciales exclusivamente del backend. Justo antes del POST, persiste INCIERTO con CHECKOUT_CREATING. El HTTP se realiza fuera de las transacciones SQL y de sus bloqueos.
8. Guarda únicamente ID externo, URL validada, estado del proveedor y códigos internos seguros. Vuelve a comprobar saldo y asociación bajo bloqueo antes de devolver la URL.
9. Estado local PENDIENTE significa checkout preparado, nunca pago confirmado. Frontend valida HTTPS, host exacto app.recurrente.com y ruta /checkout-session/ch_... antes de navegar.
10. El retorno muestra pago pendiente de verificación. Ignora parámetros que pretendan afirmar éxito; no confirma ni procesa financieramente el pago.

La reutilización usa un marcador INCIERTO/CHECKOUT_VERIFYING antes del GET. Una respuesta cierta del intento en curso puede completar su propio marcador; un reintento de una operación ya incierta se bloquea antes de hacer HTTP. No hay desbloqueos por antigüedad ni recuperación/conciliación de operaciones inciertas en HU13.

Errores de negocio tienen mensajes estáticos seguros. Se contemplan 400, 401/403, 429, 5xx, timeout de 10 segundos por solicitud, pérdida de respuesta, JSON inválido, ID/estado incoherente y URL ausente o insegura. No se copian cuerpos de error, headers, causas ni errores arbitrarios del proveedor. Un rechazo definitivo de creación queda FALLIDO; timeout, 5xx, pérdida de respuesta o resultado inválido quedan INCIERTO y bloquean otro cobro. Una consulta de reutilización fallida también conserva INCIERTO.

**4. Persistencia y migración**

Se reutiliza CHECKOUT_RECURRENTE de Fase 0 con referencia UUID, idempotency_key local, cuota, usuario, residente, casa, monto/capital/recargo en centavos, GTQ, ambiente y estados. No se guarda la llave ni datos de tarjeta.

Migración incremental `002_recurrente_checkout.sql`:

| Cambio | Verificación |
|---|---|
| checkout_url VARCHAR(2048), ASCII/binario, nullable | Aplicada y comprobada |
| sandbox_id VARCHAR(191), ASCII/binario, nullable | Aplicada y comprobada |
| estado_proveedor VARCHAR(24), nullable | CHECK de unpaid/paid/payment_in_progress/expired |
| error_codigo VARCHAR(80), nullable | Solo códigos internos, sin mensajes del proveedor |
| CHECK de estado local | Amplía el CHECK anterior atómicamente para admitir INCIERTO |
| Índice (id_cuota, estado) | Dos columnas comprobadas en information_schema |
| PK/FK/UNIQUE de Fase 0 | Permanecen vigentes; suite de regresión aprobada |
| Reaplicación de 002 | Ejecutada repetidamente; conserva todas las filas previas |
| Datos preexistentes | Columnas nuevas admiten NULL; ninguna fila se elimina |
| Destrucción de datos | Sin DROP TABLE, TRUNCATE ni DELETE en 002 |

La migración se incorpora al arranque, al script de preparación y al SQL de Docker. Durante esta validación se ejecutó exclusivamente en la base aislada. No se inició el servidor normal ni se reconstruyeron/reiniciaron sus contenedores.

HU13 no escribe PAGO, PAGO_ORIGEN, TRANSACCION_RECURRENTE, EVENTO_RECURRENTE ni REEMBOLSO_RECURRENTE al crear o reutilizar un checkout. Un status paid del proveedor tampoco genera esas escrituras. No hay procesamiento financiero de webhook, reembolsos, conciliación ni suscripciones.

Backup/restore de Fase 0 ya usa SELECT * y el catálogo de tablas financieras. No requirió cambios en sus servicios para las cuatro columnas nuevas. Se actualizó la preparación de su prueba de restauración para aplicar 002 al destino aislado existente. El round trip real volvió a comparar todas las filas de las 23 tablas admitidas, incluidos los checkouts y sus nuevos datos.

**5. Reglas financieras y concurrencia**

Se reutiliza la fuente de verdad de Fase 0; no se introduce un cálculo alternativo:

| Capital original | Recargos aplicados | Abono registrado | Recargo pendiente | Capital pendiente | Checkout autorizado |
|---|---:|---:|---:|---:|---:|
| Q100 | Q15 | Q0 | Q15 | Q100 | 11500 centavos |
| Q100 | Q15 | Q10 | Q5 | Q100 | 10500 centavos |
| Q100 | Q15 | Q50 | Q0 | Q65 | 6500 centavos |
| Q100 | Q15 | Q115 | Q0 | Q0 | Bloqueado: QUOTA_PAID |
| Q100 | Q15 | Q120 | Q0 | Q0, exceso Q5 | Bloqueado: FINANCIAL_OVERPAYMENT |
| Q10.01 | Q0 | Q0 | Q0 | Q10.01 | 1001 centavos |
| Q4.99 | Q0 | Q0 | Q0 | Q4.99 | Bloqueado: CHECKOUT_MINIMUM |

Los abonos TEST históricos de esos casos fueron fixtures explícitos. Nunca se produjeron como consecuencia de un checkout de HU13. Se verificó que sus saldos coinciden con los del estado de cuenta.

| Escenario MySQL HU13 | Resultado |
|---|---|
| Dos intentos simultáneos para la misma cuota | Un registro local y un POST mock; el segundo queda bloqueado |
| Reintento de checkout compatible | GET mock, mismo UUID/URL, ningún POST adicional |
| Saldo cambiado | No se reutiliza ni crea checkout adicional |
| 5xx, timeout, pérdida de red, JSON inválido, ausencia de URL | INCIERTO; reintento bloqueado en cada caso |
| Operación incierta fechada en 2000 | Sigue bloqueada; sin caducidad automática |
| GET con ID incorrecto | INCIERTO, conserva el ID previamente asociado |
| Credenciales que devuelven live | Ningún POST; error seguro |
| 400 definitivo | Un intento; nuevo intento explícito conserva la fila FALLIDO |
| Simulación sobre cuota PENDIENTE o INCIERTO | Rechazo antes de insertar PAGO |
| Simulación concurrente mientras se envía POST | Rechazo; ninguna aplicación financiera |
| Otra cuota sin checkout | Simulación académica funciona |
| Fallo SQL al terminar la operación | Rollback, INCIERTO persistido; sin PAGO ni otro POST en reintento |
| ID externo duplicado en otra cuota | Restricción UNIQUE; segunda operación INCIERTO y bloqueada, sin asociación incorrecta |
| HTTP con Bearer y sesión reales contra MySQL TEST | 201 con dos campos; monto enviado por frontend rechazado |
| Fixture manual Q5 | Creación/reutilización repetible, sin abonos ni recargos |

Las 25 regresiones de Fase 0 también aprobaron restricciones de IDs, svix-id por ambiente, FK, rollback de confirmaciones TEST, dos procesos con la misma transacción TEST, abonos concurrentes y backup/restore. Su helper de confirmación permanece exclusivamente en test/integration/support; no se incorpora al producto ni implementa HU14.

**6. Pruebas y resultados exactos**

| Comando | Aprobadas | Fallidas | Omitidas |
|---|---:|---:|---:|
| backend: npm.cmd test — node:test | 93 | 0 | 0 |
| backend: npm.cmd test — Jest, 39 suites | 255 | 0 | 0 |
| Backend completo, total | **348** | **0** | **0** |
| frontend: npm.cmd run test:run — 38 archivos | **103** | **0** | **0** |
| backend: npm.cmd run test:hu13:mysql | **27** | **0** | **0** |
| backend: npm.cmd run test:phase0:mysql | **25** | **0** | **0** |
| MySQL, total | **52** | **0** | **0** |
| backend: npm.cmd run test:phase0:functional | **12** | **0** | **0** |

Todos terminaron con exit code 0. La prueba HTTP nueva con autenticación y MySQL pertenece a las 27 de HU13 y no se cuenta otra vez entre las 12 funcionales existentes.

Pruebas específicas añadidas/adaptadas: cliente (42), servicio checkout (31), rutas (19), bloqueo adicional de simulación (3), seguridad del entorno manual (3), frontend servicio/redirección (12), vista de pago (6, sustituyen las 2 del flujo anterior) y retorno (1). El backend crece en 98 pruebas respecto a Fase 0 y el frontend en 17. Los mocks usan únicamente valores FAKE/TEST y fetch inyectado, sin llamadas externas.

Infraestructura: MySQL **8.4.8**, imagen local mysql:8.4, contenedor **nexus-phase0-test-20261001-a9a8f83b**, puerto **127.0.0.1:20378**. Base **nexus_phase0_test_20261001_a9a8f83b**; restauraciones únicamente en **nexus_phase0_test_20261001_a9a8f83b_restore**. La base normal NexusResidencial no fue modificada.

Build frontend: `npm.cmd run build`, **exit code 0**, 2377 módulos, JavaScript 1151.52 kB / gzip 322.81 kB. Permanece la advertencia preexistente de chunk mayor a 500 kB; no impide el build.

**7. Revisión Git y secretos**

- git diff --check: exit code 0, sin hallazgos.
- Staging: vacío; git diff --cached --name-only no devuelve archivos.
- Ningún archivo .env real existe actualmente en raíz, backend o frontend; solo plantillas. No se creó ni modificó un .env local.
- backend/.env.example mantiene las tres variables RECURRENTE vacías.
- git check-ignore confirma protección de .env, backend/.env y frontend/.env.
- Escaneo de patrones de llaves reales: sin coincidencias en fuentes, tests, documentación y build.
- Frontend/src de producto y frontend/dist sin nombres de secretos Recurrente ni header X-SECRET-KEY.
- No hubo llamadas a app.recurrente.com/api durante el desarrollo/tests. Las consultas externas fueron a documentación pública oficial.
- Ningún pago real confirmado, uso de tarjeta o dinero real. La creación/reutilización de checkout no inserta PAGO.
- Sin commits, push, merge ni ramas nuevas.

El diff/status siguientes corresponden al repositorio completo respecto a Git, incluyendo cambios previos. git diff --stat no enumera archivos todavía untracked; la lista de archivos HU13 de la sección 1 sí los incluye.

`git diff --stat`:

```text
 proyecyo-1/.env.example                            |  5 ++
 proyecyo-1/backend/.env.example                    |  6 ++
 proyecyo-1/backend/package.json                    |  5 ++
 proyecyo-1/backend/server.js                       |  8 ++-
 proyecyo-1/backend/sql/Dockerfile                  |  2 +
 proyecyo-1/backend/src/app.js                      | 13 +++--
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
 45 files changed, 440 insertions(+), 222 deletions(-)
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
?? backend/src/controllers/recurrenteCheckoutController.js
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
?? backend/src/services/__tests__/surchargeBalance.test.js
?? backend/src/services/financialBalance.js
?? backend/src/services/recurrenteCheckoutErrors.js
?? backend/src/services/recurrenteCheckoutGuard.js
?? backend/src/services/recurrenteCheckoutService.js
?? backend/src/services/recurrenteClient.js
?? backend/src/utils/__tests__/safeLogger.test.js
?? backend/src/utils/recurrenteCheckoutUrl.js
?? backend/src/utils/safeLogger.js
?? backend/test/integration/
?? docs/recurrente-fase0-validacion-mysql.md
?? docs/recurrente-fase0.md
?? docs/recurrente-hu13.md
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

**8. Prueba manual Sandbox: ejecución exclusivamente por el usuario**

La prueba real no se ha ejecutado. HU13 usa fetch nativo de Node (Docker backend Node 20 / entorno local Node 22); no se instalaron dependencias nuevas. Svix permanece para HU14.

Archivo local para tus credenciales:

`C:\Users\VICTUS\Documents\olasoft\Proyecto-1---software\proyecyo-1\backend\.env`

Crea ese archivo a partir de backend/.env.example si todavía no existe. Edita localmente RECURRENTE_SECRET_KEY con la llave del Sandbox y RECURRENTE_SANDBOX_ID con su ID. Mantén RECURRENTE_WEBHOOK_SECRET vacío en HU13. No pegues esos valores en chat, código, comandos o frontend. Las asignaciones en la plantilla están vacías intencionalmente.

Primera ventana PowerShell, cuando autorices la prueba:

```powershell
Set-Location 'C:\Users\VICTUS\Documents\olasoft\Proyecto-1---software\proyecyo-1\backend'
if (-not (Test-Path -LiteralPath '.env')) { Copy-Item -LiteralPath '.env.example' -Destination '.env' }
notepad .env
```

Guarda tus dos valores solo en ese editor local. Comprueba que Docker Desktop esté abierto y que el contenedor aislado siga activo:

```powershell
docker inspect --format "{{.State.Status}}" nexus-phase0-test-20261001-a9a8f83b
```

Debe mostrar running. Si el contenedor existe y está detenido, puedes abrir Docker Desktop y ejecutar `docker start nexus-phase0-test-20261001-a9a8f83b`. Si no existe o el puerto 20378 pertenece a otro motor, detente: estas instrucciones no sustituyen la infraestructura por la base normal.

En esa misma primera ventana:

```powershell
$env:RUN_PHASE0_MYSQL_TESTS='1'
$env:PHASE0_TEST_DATABASE='nexus_phase0_test_20261001_a9a8f83b'
$env:PHASE0_TEST_PORT='20378'
npm.cmd run start:hu13:sandbox
```

Este comando fuerza conexión al MySQL aislado, aplica preparación/002 allí, crea o reutiliza una cuota TEST Q5, desactiva envíos externos de correo y arranca únicamente la app en 127.0.0.1:3100, sin schedulers. Sus guardas rechazan nombres/puertos normales y requieren activación explícita. No contacta a Recurrente al arrancar: el GET /test y POST /checkouts ocurren cuando pulses Pagar. Se validó su configuración y su fixture mediante tests; no se inició con credenciales reales.

Segunda ventana PowerShell:

```powershell
Set-Location 'C:\Users\VICTUS\Documents\olasoft\Proyecto-1---software\proyecyo-1\frontend'
$env:VITE_API_URL='http://localhost:3100'
npm.cmd run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

Abre **http://localhost:5174/login**. Usa **residente@test.com**, contraseña de fixture **1234**, y entra en **http://localhost:5174/residente/estado-cuenta**. Selecciona el servicio **HU13 Sandbox Q5 TEST** (el backend imprime su id_cuota) y pulsa Pagar una vez.

Verifica que se abra únicamente la URL hospedada en app.recurrente.com y que el importe sea Q5/GTQ dentro de tu Sandbox. Para probar HU13 basta verificar la apertura y monto del checkout; no necesitas ingresar tarjeta ni completar el pago. El regreso a /residente/pagos/retorno mostrará pendiente de verificación. Si el proveedor ya indica paid, HU13 tampoco aplicará el abono: esa confirmación corresponde a HU14.

Un reintento compatible consultará el checkout y conservará referencia/URL; una operación INCIERTO permanecerá bloqueada. Detén las dos ventanas con Ctrl+C al finalizar. Conserva el contenedor, su volumen y los fixtures; no uses docker compose down -v ni init.sql sobre la base normal.

Antes de avanzar a HU14 queda pendiente la prueba manual autorizada del contrato/respuesta real dentro de tu Sandbox. La recuperación de estados inciertos, confirmación financiera, webhook Svix e idempotencia de eventos siguen en las historias futuras aprobadas.
