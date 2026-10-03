# HU17 — Conciliación administrativa de pagos

Sprint 9 · 5 puntos. Implementación calculada y de **solo lectura financiera**.
HU13, HU14 y HU15 siguen siendo los únicos flujos que crean checkouts,
confirman pagos o resuelven reintentos. HU16 conserva sus comprobantes.

## Arquitectura y endpoints

| Endpoint NexusResidencial | Función |
| --- | --- |
| `GET /admin/pagos/recurrente/transacciones` | Lee únicamente MySQL; aplica filtros; devuelve operaciones sin verificación externa, inicialmente PENDIENTE. |
| `POST /admin/pagos/recurrente/conciliacion` | Obtiene snapshot consistente local, valida contexto Sandbox, consulta recursos externos mediante GET, vuelve a leer MySQL y calcula comparación. |
| `/admin/pagos/conciliacion` | Vista administrativa, enlace «Conciliación de pagos» del menú. |

La respuesta no se persiste. No se agregó tabla, migración, dependencia ni
historial durable de verificaciones. Tampoco se modifica `verificado_en` de HU15.
Las respuestas HTTP usan `Cache-Control: private, no-store`.

La unidad de comparación es el intento `(sandbox, in_*)`. Un checkout que aún
no tenga intento local aparece como operación pendiente o como diferencia si
ya está pagado externamente y falta el registro local. Los candidatos externos
sin asociación se presentan aparte; no se les asigna cuota ni residente por
suposición. Retiros, liquidaciones y netos después de comisiones quedan fuera.

### Contrato de entrada

POST admite una de estas selecciones:

```json
{ "id_transaccion": 296 }
```

```json
{ "ids_transacciones": [296, 486] }
```

```json
{ "id_checkout": 433 }
```

O filtros, con descubrimiento externo opcional:

```json
{
  "filtros": { "desde": "2026-10-01", "hasta": "2026-10-03", "residente": "1" },
  "descubrir_externas": false
}
```

Selecciones y filtros no se mezclan. Máximo 100 IDs de transacción por selección;
máximo 200 operaciones visibles/verificadas por consulta. Claves desconocidas,
fechas imposibles, referencias arbitrarias e importes/monedas/estados financieros
enviados por el navegador se rechazan. No se aceptan URLs externas del cliente.
Una consulta local vacía no abre conexiones HTTP a Recurrente.

### Recursos oficiales Recurrente

Base fija `https://app.recurrente.com/api`; el nuevo cliente admite únicamente GET:

| Recurso | Uso |
| --- | --- |
| `/test` | Valida `environment === sandbox`, sandbox esperado y cuenta `ac_*`, antes de consultar operaciones. |
| `/intents/{in_*}` | Evidencia del intento individual. |
| `/checkouts/{ch_*}` | Evidencia del checkout individual y referencia `payment.id` cuando está disponible. |
| `/intents` | Solo descubrimiento explícito por período; se excluyen intentos no `payment` de los candidatos. |
| `/checkouts` | Solo descubrimiento explícito por período. |

Contratos revisados en la documentación oficial: [credenciales](https://docs.recurrente.com/referencia-api/api-reference/test/credentials),
[obtener intent](https://docs.recurrente.com/referencia-api/api-reference/intents/get-intent),
[obtener checkout](https://docs.recurrente.com/referencia-api/api-reference/checkouts/get-checkout),
[listar intents](https://docs.recurrente.com/referencia-api/api-reference/intents/list-intents),
[listar checkouts](https://docs.recurrente.com/referencia-api/api-reference/checkouts/list-checkouts),
[paginación](https://docs.recurrente.com/guias-espanol/comenzar/paginacion).

No se inventan GET `/payments` ni GET `/payment_intents`. El nuevo cliente de
lectura conserva montos y monedas externos válidos, aunque difieran del valor
local. Una moneda USD, por ejemplo, debe poder mostrarse como DIFERENCIA frente
a GTQ, en lugar de transformarse en una respuesta inválida.

## Matriz de clasificación

| Resultado | Evidencia |
| --- | --- |
| CONCILIADA | `succeeded` + `paid` + CONFIRMADA + PAGO y aplicación coherentes; o `failed`/`canceled` con FALLIDA/CANCELADA y sin PAGO ni aplicación. |
| DIFERENCIA | Monto, moneda, ambiente explícito, identidad, asociación, fecha o estado incompatibles; pago externo confirmado sin PAGO local; referencia 404 después de validar cuenta/Sandbox. |
| PENDIENTE | Datos requeridos ausentes, falta de desenlace, operación en progreso/incierta, checkout sin intento, cambio concurrente local/externo o reembolso pendiente del flujo HU18. |
| ERROR_DE_VERIFICACION | Timeout, autenticación 401/403, 429, 5xx, JSON malformado o contexto Sandbox no verificable. |

Cada resultado incluye diferencias por campo con valor interno/externo,
comprobaciones y datos faltantes. El fallo del proveedor no se convierte en una
diferencia financiera. Una referencia 404 del propio `/test` no prueba ausencia
de operación y se clasifica como error de verificación.

Se comparan IDs `in_*`, `ch_*`, centavos enteros, moneda, cuenta/Sandbox, estado
del intento, estado del checkout local/proveedor, estado de transacción, cuota,
usuario, residente y casa. Para éxitos se comprueban `id_pago`, origen RECURRENTE,
ambiente, importe, referencia externa PA cuando disponible, fecha contable y
suma de capital/recargos aplicados. Para intentos negativos se exige ausencia de
PAGO, confirmación y aplicación financiera. Un intento antiguo fallido puede
seguir conciliado aunque otro intento del mismo checkout posteriormente pague:
no se confunde su referencia PA con la del último pago del checkout.

Si dos GET externos observan estados distintos del mismo checkout, el resultado
es PENDIENTE. HU17 observa reembolsos existentes solo para indicar que requieren
el futuro flujo HU18, sin ejecutarlos ni descontarlos.

## Fechas, filtros y saldos

- `desde`/`hasta`: fechas inclusivas de America/Guatemala. Se usa el timestamp
  oficial del intento, con fallback a la fecha contable ya verificada de PAGO.
  Durante la verificación se considera la fecha oficial externa si está disponible.
- Sin fecha verificable: la operación permanece visible aun con filtro temporal
  y se cuenta explícitamente en el resumen. Nunca se usa NOW() como fecha del pago.
- `estado_local`: estado del intento cuando existe; de lo contrario, del checkout.
- `resultado`: las cuatro clasificaciones. El resumen conserva el alcance total
  evaluado aunque se muestre solo un resultado; en GET local todavía no hay
  operaciones CONCILIADAS pues no se ha realizado consulta externa.
- `residente`: ID local del residente asociado al checkout.
- `referencia`: coincidencia exacta de ID local de transacción, checkout, PAGO o
  cuota; UUID local; `ch_*`, `in_*`, `pa_*` o `NXR-*` de un PAGO.

El saldo mostrado proviene de `QUOTA_BALANCES_SQL` de Fase 0: **todos los abonos
confirmados, incluidos los que estén fuera del período**. El período limita
movimientos, no resucita deudas pagadas. Se conserva recargos primero, capital
después, sin saldo negativo y con sobrepago explícito. HU17 no aplica abonos.

## Concurrencia y paginación

Cada lectura local usa una transacción SQL READ ONLY con snapshot consistente.
Se cierra/libera antes de esperar HTTP. Después de los GET se obtiene un segundo
snapshot; una variación de los datos observados produce PENDIENTE con motivo
CAMBIO_CONCURRENTE. No existen bloqueos SQL mantenidos durante las llamadas HTTP.
Hasta cuatro operaciones se verifican simultáneamente. Las solicitudes HTTP
idénticas simultáneas pueden compartir una promesa en memoria, aislada por
cuenta/Sandbox; se descarta al terminar y no constituye historial ni caché durable.

El catálogo local devuelve como máximo 200 filas y declara parcial si existen
más. Para explorar otros registros debe acotarse la selección con filtros.
El descubrimiento externo es optativo y requiere ambas fechas. Tiene máximo
20 páginas por recurso y 100 elementos por página. Usa los parámetros del
período y evidencia del proveedor (`Link`, `current-page`, `total-pages`,
`total-count` cuando se presenta). Nunca infiere fin por una página corta/vacía.

Los enlaces deben conservar HTTPS/origen/ruta/período/tamaño de página y no
contener credenciales ni parámetros inesperados. Ciclos, enlaces inválidos,
límites, registros contradictorios o falta de evidencia de fin generan alcance
parcial. Se deduplican IDs idénticos. Se comprueba asociación local por las
referencias externas descubiertas, independientemente de los filtros activos;
si esa búsqueda es parcial, se omiten los candidatos para no etiquetar registros
conocidos como ajenos. `completo` se refiere al **alcance solicitado**, no a todas
las operaciones históricas del proveedor.

## Seguridad y ausencia de efectos financieros

ADMIN requiere token bearer firmado, sesión activa no revocada y rol/actividad
actual del usuario consultados en MySQL. No se aceptan `x-user-id` ni
`x-user-role`, tampoco como bypass de pruebas. La denegación ocurre antes de
abrir el cliente Recurrente. El frontend también protege la ruta ADMIN.

La llave se obtiene exclusivamente del entorno backend. El cliente fija host,
restringe referencias, no sigue redirects, usa timeout y limita la respuesta
a 1 MiB. Solo devuelve un DTO allowlist. Se descartan payloads originales,
headers, tarjetas, customer data y textos arbitrarios de fallos; los motivos
se convierten al catálogo seguro que ya utiliza HU15. Las respuestas del cliente
HTTP y la UI usan códigos/mensajes seguros, sin causas crudas del proveedor.

HU17 no escribe CUOTA, PAGO, PAGO_ORIGEN, CHECKOUT_RECURRENTE,
TRANSACCION_RECURRENTE, EVENTO_RECURRENTE ni REEMBOLSO_RECURRENTE. No procesa
webhooks, retries, replays, confirmaciones, cobros, nuevas operaciones ni
correcciones. Solo se permite la actividad normal de autenticación de sesión.
La vista ofrece consulta/verificación y detalles, sin botones financieros.

## Archivos HU17

Creados:

- `backend/src/middlewares/requireAdminSession.js`
- `backend/src/controllers/adminRecurrenteReconciliationController.js`
- `backend/src/routes/adminRecurrenteReconciliationRoutes.js`
- `backend/src/services/recurrenteReadClient.js`
- `backend/src/services/recurrenteReconciliationCompare.js`
- `backend/src/services/recurrenteReconciliationService.js`
- `backend/src/services/__tests__/recurrenteReadClient.hu17.test.js`
- `backend/src/services/__tests__/recurrenteReconciliation.hu17.test.js`
- `backend/src/routes/__tests__/recurrenteReconciliation.hu17.routes.test.js`
- `backend/test/fixtures/hu17.js`
- `backend/test/integration/hu17.mysql.test.js`
- `frontend/src/types/recurrenteReconciliation.ts`
- `frontend/src/services/recurrenteReconciliationService.ts`
- `frontend/src/services/recurrenteReconciliationService.test.ts`
- `frontend/src/views/AdminRecurrenteReconciliationView.tsx`
- `frontend/src/views/AdminRecurrenteReconciliationView.test.tsx`
- `docs/recurrente-hu17.md`

Modificados: `backend/src/app.js`, `backend/package.json`,
`backend/scripts/run-isolated-tests.js`, `frontend/src/routes/AppRouter.tsx`,
`frontend/src/components/admin/AdminLayout.tsx`. Se preservan los cambios
preexistentes de las fases anteriores.

## Subtareas y evidencia

| # | Subtarea | Evidencia implementada |
| --- | --- | --- |
| 1 | Consultar transacciones | GET local, SELECT/snapshot, filtros, sin cliente HTTP. |
| 2 | Obtener operaciones pasarela | Cliente GET específico, preflight, recursos individuales y descubrimiento optativo. |
| 3 | Comparar registros | Comparador puro por intento, centavos, referencias, estados, fechas y vínculos financieros. |
| 4 | Identificar conciliadas | Casos succeeded/paid y failed/canceled consistentes. |
| 5 | Detectar diferencias | Lista por campo, sin confundir fallos HTTP con discrepancias. |
| 6 | Filtros | Validados backend; pruebas de SQL por fecha, estado, residente y múltiples referencias. |
| 7 | Interfaz ADMIN | Vista/ruta/menú, resumen y tabla. |
| 8 | Mostrar diferencias | Detalle interno/externo, motivo, faltantes y clasificación visible. |
| 9 | ADMIN exclusivo | Sesión firmada/activa + rol en DB, tests de residente/revocación/headers falsificados. |
| 10 | Pruebas | Unitarias, rutas, frontend, MySQL temporal, regresión de fases anteriores y build. |

## Pruebas y comandos

Todas las respuestas Recurrente son mocks/fixtures. Las pruebas borran las
credenciales del entorno del proceso antes de importar la aplicación. No se
usó la Secret Key real ni se realizó una consulta real a Recurrente.

MySQL 8.4.8, `127.0.0.1:20378`: el runner crea una base propia
`nexus_phase0_test_20261001_a9a8f83b_run_<token>`. Valida UUID de propiedad antes
de cualquier eliminación y borra solo sus bases temporales. La base compartida
se usa únicamente para copiar fixtures y verificar los conteos/evidencias antes
y después. La base normal no se utiliza.

```powershell
# Backend: estas variables son TEST, no credenciales.
$env:RUN_PHASE0_MYSQL_TESTS='1'
$env:PHASE0_TEST_DATABASE='nexus_phase0_test_20261001_a9a8f83b'
$env:PHASE0_TEST_PORT='20378'
npm.cmd run test:hu17:mysql
npm.cmd run test:phase0:mysql
npm.cmd run test:hu13:mysql
npm.cmd run test:hu14:mysql
npm.cmd run test:hu15:mysql
npm.cmd run test:hu16:mysql
npm.cmd run test:isolated:backend
npm.cmd run test:phase0:functional
# Frontend, desde su directorio:
npm.cmd test -- --run
npm.cmd run build
```

Cobertura específica: éxito, fallo/cancelación sin abono, diferencias de monto,
moneda, ambiente, asociaciones/estado/fecha; PAGO ausente o incompatible; 404
con/sin contexto, timeout, 401/403/429/5xx y respuesta inválida; evidencia
incompleta, progreso/pendiente/incierto, eventos duplicados, cambios concurrentes,
verificación repetida/simultánea, filtros, no ADMIN, revocación, identidad
falsificada, estados visuales, loading/doble clic y cero efectos financieros.
También hay pruebas de exploración parcial, enlaces seguros, ciclos y recuentos.

Los tests MySQL comparan todos los registros de las ocho tablas financieras
observadas antes/después. Verifican la copia exacta de PAGO 395, transacción 296,
checkout 433 y la FALLIDA 486/unpaid 937 sin abono; el runner comprueba de nuevo
que la evidencia compartida y sus conteos quedaron intactos.

### Resultados finales

Ejecución del 2026-10-03. Todos los resultados finales: **0 fallos y 0 omitidas**.

| Suite | Aprobadas | Fallidas | Omitidas |
| --- | ---: | ---: | ---: |
| Backend específico HU17 (Jest, 3 suites) | 93 | 0 | 0 |
| Frontend específico HU17 (2 archivos) | 14 | 0 | 0 |
| MySQL HU17 | 23 | 0 | 0 |
| MySQL Phase 0 | 25 | 0 | 0 |
| MySQL HU13 | 27 | 0 | 0 |
| MySQL HU14 | 74 | 0 | 0 |
| MySQL HU15 | 54 | 0 | 0 |
| MySQL HU16 | 30 | 0 | 0 |
| Backend completo: Node 93 + Jest 563 (51 suites) | 656 | 0 | 0 |
| Funcionales generales (runner aislado) | 12 | 0 | 0 |
| Frontend completo (44 archivos) | 151 | 0 | 0 |

Los conteos específicos están incluidos en los completos; no deben sumarse
como casos únicos adicionales. MySQL HU17 se repitió tras las correcciones del
comparador/diagnóstico 404 y volvió a aprobar 23/23; última base temporal:
`nexus_phase0_test_20261001_a9a8f83b_run_c0874d`, eliminada por su runner.
Cada suite creó/eliminó su base temporal
con verificación de propiedad; Phase 0 también eliminó su copia de restauración.

Build frontend: **OK**, 2381 módulos. Vite mantiene un aviso de tamaño del bundle
principal (1169.01 kB sin gzip); no es un error de compilación. `git diff --check`:
**OK**; archivos nuevos sin whitespace final. Staging vacío.

Durante la primera ejecución se corrigieron un caso de estado externo ausente
que no debía producir DIFERENCIA y los selectores/presentación de texto de las
pruebas frontend. La revisión final también precisó si un 404 corresponde
al checkout o al intento, con dos casos específicos. Los resultados de arriba corresponden a las ejecuciones
finales completas, sin esos fallos.

Auditoría final contra la captura previa: los 23 conteos de tablas compartidas,
todos los registros protegidos y los reembolsos asociados permanecieron iguales.

| Cuota | PAGO | Transacción | Checkout | Saldo real |
| --- | --- | --- | --- | --- |
| 171 | Únicamente 395, Q5.00 | 296 CONFIRMADA, id_pago 395 | 433 CONFIRMADO / paid | Q0.00 |
| 998 | 0 registros | 486 FALLIDA, id_pago NULL | 937 PENDIENTE / unpaid | Q5.00 |

La revisión por SHA256 identificó exclusivamente 5 archivos preexistentes
modificados para HU17 y 17 archivos nuevos; los otros 476 archivos originales
conservaron su contenido y no se eliminó ninguno. `.env` conserva tamaño/mtime,
está ignorado y no está versionado; no se leyó su contenido en la auditoría.
El escaneo de los archivos de HU17 no encontró patrones de credenciales reales.
Los valores usados por tests son fixtures deliberadamente ficticios.

El `git diff --stat` global (solo archivos versionados, incluye cambios de fases
previas) muestra `50 files changed, 657 insertions(+), 243 deletions(-)`.
Los archivos nuevos de HU17 permanecen sin staging, por lo que ese estadístico
no representa por sí solo el tamaño de HU17.

## Límites y validación manual

No se realizó validación manual HU17 contra Recurrente Sandbox. La compatibilidad
con respuestas reales se verificará después de autorización del usuario. Campos
opcionales ausentes no se inventan: los necesarios para decidir producen
PENDIENTE. La paginación no documentada en detalle para un listado se trata
conservadoramente como parcial si su respuesta no demuestra el fin.

No se concilian comisiones/liquidaciones ni se ejecutan reembolsos/correcciones.
No hay historial durable de verificaciones por política aprobada. No se creó
migración, se modificó .env, se usó la BD normal ni se hizo commit/push/merge
o una nueva rama.
