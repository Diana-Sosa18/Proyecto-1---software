# Phase 0 — Corrección del aislamiento de backup/restore

Fecha: 2026-10-03. Alcance: corregir la regresión de pruebas MySQL y evitar acumulación permanente de fixtures. No se modificaron funcionalidades HU13–HU16, reglas financieras, límites de la aplicación, credenciales ni datos de la evidencia manual.

## 1–3. Causa raíz y límite de 2 MiB

La prueba `backend/test/integration/phase0.mysql.test.js`, “backup y restore real conservan las cinco tablas y referencias compuestas”, exportaba TODA la base compartida que también contiene la evidencia manual. Las suites agregaban obligaciones, recargos, pagos y operaciones/eventos con identificadores nuevos en cada ejecución y no retiraban sus fixtures. Por tanto, el conjunto exportado dependía de cuántas veces se habían ejecutado otras suites.

La prueba fallaba en `validateBackupPayload()` antes de restaurar: el respaldo acumulado excedía el límite del servicio de restauración. **El límite no era una aserción exclusiva de la prueba.**

| Archivo | Definición/uso |
| --- | --- |
| `backend/src/services/restoresService.js:5` | `MAX_BACKUP_SIZE_BYTES = 2 * 1024 * 1024`, comprobado al validar contenido. |
| `backend/src/services/automaticBackupsService.js:108` | Rechaza generar un archivo incompatible mayor de 2 MiB. |
| `frontend/src/views/AdminSettingsView.tsx:29` | Guarda del archivo seleccionado y texto “máximo 2 MB”. |
| `backend/test/restores.test.js:44` | Prueba del rechazo de contenido superior al límite. |
| `docs/hu5-restauracion-respaldos.md` | Documenta restauración de `.sql` hasta 2 MB y rechazo de archivos mayores. |
| `docs/HU14-respaldos-automaticos.md` | Documentación histórica de respaldos: conserva compatibilidad con el límite de restauración. Esta numeración histórica no redefine HU14 del Sprint 9. |

Su propósito observable es limitar el tamaño del contenido aceptado por restauración y mantener compatibilidad entre generación, carga y validación. El repositorio no explica por qué se eligió exactamente 2 MiB, pero sí establece ese tamaño como contrato funcional de la interfaz y los servicios. **No se aumentó ni eliminó.**

## 4–5. Crecimiento medido y acumulación

Al iniciar esta corrección, el respaldo completo medía **2,543,839 bytes**. Es mayor que la medición anterior de 2,165,332 porque las suites posteriores siguieron incorporando fixtures a la misma base. Esta cifra corresponde a SQL serializado, incluyendo nombres de columnas y sentencias; no es el tamaño físico de las tablas InnoDB.

| Tabla | Registros | Bytes SQL aproximados |
| --- | ---: | ---: |
| CHECKOUT_RECURRENTE | 1072 | 796934 |
| EVENTO_RECURRENTE | 764 | 578614 |
| TRANSACCION_RECURRENTE | 466 | 403162 |
| RECARGO_APLICADO | 1102 | 294276 |
| CUOTA | 1209 | 210259 |
| PAGO_ORIGEN | 599 | 121987 |
| PAGO | 599 | 96599 |
| REEMBOLSO_RECURRENTE | 33 | 18029 |
| TRANSACCION_SIMULADA | 31 | 9349 |
| CONFIGURACION | 19 | 3448 |
| RESERVA | 8 | 1975 |
| SERVICIO | 8 | 1888 |
| AMENIDAD | 6 | 1727 |
| USUARIO | 6 | 1630 |
| ACCESO | 3 | 1264 |
| CASA_SERVICIO | 4 | 960 |
| TIPO_USUARIO | 4 | 586 |
| VISITANTE | 3 | 535 |
| INQUILINO | 1 | 145 |
| CASA | 1 | 139 |
| INQUILINO_CASA | 1 | 132 |
| RESIDENTE | 1 | 130 |
| REGISTRO_ACCESO | 0 | 0 |

Checkouts, eventos y transacciones representan aproximadamente el 70% del respaldo. EVENTO_RECURRENTE contiene metadatos de auditoría, referencias, códigos/motivos sanitizados y `hash_body`; **no tiene una columna de payload original completo**. De 764 eventos, 749 contienen la marca TEST en `svix_id`; los restantes también pueden incluir fixtures UUID sin esa marca, además de la evidencia manual. No se encontraron duplicados de `(ambiente, svix_id)` ni de `(ambiente, id_externo)` de transacciones. La acumulación procede de nuevos registros de escenarios similares, con identificadores únicos, no de una violación de idempotencia de los pagos protegidos.

`initializeTestSchema()` conservaba todas las filas de una base ya inicializada. Los fixtures usaban INSERT y UUID nuevos; los hooks finales cerraban conexiones, pero no retiraban filas. Phase 0 también dejaba destinos de restauración anteriores. Esto hacía crecer el dataset permanentemente entre invocaciones.

No se encontró un payload TEST gigantesco ni una tabla ajena responsable del problema. El respaldo mantiene las 23 tablas de la lista explícita existente; sus tablas financieras son necesarias. El problema era exportar también todos los fixtures temporales acumulados de ejecuciones ajenas. No se cambió la lista ni se omitieron filas del dataset de la suite.

## 6–7. Corrección realizada y justificación

Cada script de pruebas utiliza ahora `scripts/run-isolated-tests.js`:

1. Exige `RUN_PHASE0_MYSQL_TESTS=1`, nombre original TEST estricto y puerto aislado; no hay valores por defecto de la base normal.
2. Crea una base propia con nombre `<base_TEST>_run_<6hex>` dentro del mismo MySQL TEST en 127.0.0.1:20378. Nunca adopta una base existente.
3. Registra una marca de propietario con UUID completo en una tabla exclusiva de infraestructura de tests, `NEXUS_TEST_RUN_OWNER`. No es una migración ni una tabla de NexusResidencial.
4. Inicializa el esquema/dataset controlado y aplica las migraciones existentes. Lee la evidencia 171/998 y sus dependencias de la base compartida y la copia a la base temporal, respetando el orden de FK. Los registros originales solo se consultan.
5. Ejecuta la suite con credenciales del proveedor vacías, sin fallback a la base normal. Las suites rechazan la ejecución directa sobre la base compartida; `test-phase0-functional.js` utiliza la misma guarda.
6. En `finally`, verifica evidencia y conteos originales, valida el nombre y UUID de propiedad de TODOS los candidatos y elimina únicamente la base creada para esa ejecución y sus destinos de restore propios. Un destino original, antiguo, ajeno o con propietario diferente no puede eliminarse.
7. Los archivos temporales de backup se ubican en un directorio propio creado mediante `mkdtemp`; solo ese directorio, cuya ruta se verifica, se retira al terminar.

La marca de propietario es infraestructura, no contenido financiero que deba exportarse. El generador de la aplicación conserva exactamente su lista de tablas. No se comprimió ni filtró el respaldo para obtener un resultado verde.

La prueba de backup/restore mantiene `validateBackupPayload()` y añade verificaciones útiles:

- Contenido generado y no vacío, sin nombres/formatos de Secret Key o Webhook Secret.
- Todas las tablas requeridas y todas las tablas no vacías del dataset.
- Número exacto de sentencias correspondiente al número esperado de filas.
- Destino de restauración con todas las tablas de aplicación inicialmente vacías; solo se proporciona el administrador requerido para el registro de auditoría.
- Restauración real mediante el mismo servicio de la aplicación.
- Igualdad de conteos y de todas las columnas de todas las tablas exportadas.
- Validación referencial después de restaurar.
- Igualdad de PK, FK, UNIQUE y CHECK entre origen y destino.

Es mejor que aumentar el límite porque corrige la causa del crecimiento, mantiene el contrato documentado y verifica integridad de datos en lugar de depender del historial de ejecuciones. Los históricos ya acumulados se conservan; no se eliminan fixtures antiguos de la base compartida. El respaldo compartido sigue superando el límite funcional y continuará siendo rechazado por la aplicación: esta corrección no cambia esa política.

## 8. Archivos

Modificados respecto al estado aprobado de HU16:

- `backend/package.json`: scripts MySQL/funcionales con runner y `test:isolated:backend`.
- `backend/test/integration/support/isolatedMysql.js`: acepta nombres propios de ejecución manteniendo host/puerto y guardas estrictas.
- `backend/test/integration/support/initializeTestSchema.js`: distingue la marca de propietario de tablas ya inicializadas.
- `backend/test/integration/phase0.mysql.test.js`: guarda de ejecución y verificaciones de integridad/restauración.
- `backend/test/integration/hu13.mysql.test.js`: guarda contra escribir en la base compartida.
- `backend/test/integration/hu14.mysql.test.js`: misma guarda.
- `backend/test/integration/hu15.mysql.test.js`: misma guarda.
- `backend/test/integration/hu16.mysql.test.js`: misma guarda; sigue probando la copia exacta del PAGO 395 y el caso negativo 486.
- `backend/scripts/test-phase0-functional.js`: exige base propia del runner.
- `docs/recurrente-hu16.md`: nota que actualiza el pendiente de la validación inicial.

Creados:

- `backend/scripts/run-isolated-tests.js`
- `backend/test/integration/support/suiteIsolation.js`
- `backend/src/database/__tests__/suiteIsolation.test.js`
- `docs/recurrente-fase0-aislamiento-tests.md`

No se modificaron servicios/rutas de producción, frontend, SQL de migraciones, reglas financieras, `.env` ni lockfiles.

## 9–19. Resultados

| Punto | Validación | Aprobadas | Fallidas | Omitidas |
| --- | --- | ---: | ---: | ---: |
| 9 | Phase 0, primera ejecución | 25 | 0 | 0 |
| 10 | Phase 0, segunda ejecución | 25 | 0 | 0 |
| 11 | MySQL HU13 | 27 | 0 | 0 |
| 12 | MySQL HU14 | 74 | 0 | 0 |
| 13 | MySQL HU15 | 54 | 0 | 0 |
| 14 | MySQL HU16 | 30 | 0 | 0 |
| 15 | Backend completo | 563 | 0 | 0 |
| 16 | Funcionales | 12 | 0 | 0 |
| 17 | Frontend completo | 137 | 0 | 0 |

Backend: 93 tests Node + 470 Jest en 48 suites, incluidos 11 casos nuevos de nombres, propiedad y protección de cleanup. Frontend: 42 archivos. Build (18): **OK**, 2379 módulos, conserva la advertencia existente de bundle mayor a 500 kB. `git diff --check` (19): **OK**; staging vacío.

Las dos ejecuciones Phase 0 fueron consecutivas dentro de **la misma base** `nexus_phase0_test_20261001_a9a8f83b_run_92cad1`, sin vaciarla ni reinicializar sus datos entre ejecuciones:

| Ejecución | Bytes backup | Filas exportadas/restauradas |
| --- | ---: | ---: |
| Primera | 60345 | 200 |
| Segunda | 98675 | 319 |

La segunda corrida incluyó el dataset anterior y pasó todas las verificaciones. Al finalizar se retiraron esa base y sus dos destinos de restore propios. Las otras seis suites con infraestructura utilizaron y limpiaron una base propia cada una. No permanecen bases nuevas acumuladas tras la validación.

Comando reproducible desde `backend/`, con las variables TEST ya definidas en el proceso (sin editar `.env`):

```powershell
$env:RUN_PHASE0_MYSQL_TESTS='1'
$env:PHASE0_TEST_DATABASE='nexus_phase0_test_20261001_a9a8f83b'
$env:PHASE0_TEST_PORT='20378'
npm.cmd run test:phase0:mysql -- --repeat=2
```

Los comandos habituales `test:hu13:mysql`, `test:hu14:mysql`, `test:hu15:mysql`, `test:hu16:mysql` y `test:phase0:functional` conservan sus nombres y ahora ejecutan el aislamiento automáticamente. `npm.cmd run test:isolated:backend` ejecuta `npm.cmd test` completo con la misma configuración segura.

## 20–24. Preservación y restricciones

Comparación final de todas las columnas de CUOTA 171/998, sus PAGO, PAGO_ORIGEN, TRANSACCION_RECURRENTE y CHECKOUT_RECURRENTE, más los eventos originales 348/349/859/860: **idénticos a la captura inicial**.

**20. Cuota 171 intacta:** un único PAGO 395 de Q5.00, fecha 2026-10-02; saldo real Q0.00; transacción 296 CONFIRMADA; checkout 433 CONFIRMADO/paid.

**21. Cuota 998 intacta:** 0 PAGO; saldo real Q5.00; transacción 486 FALLIDA con `id_pago=NULL`; checkout 937 PENDIENTE/unpaid.

Los conteos de todas las tablas de respaldo de la base compartida no cambiaron. Su SQL generado mide **2,543,839 bytes antes y después**. Las dos bases de restore históricas anteriores siguen presentes; no se tocaron. No se borraron filas existentes ni se redujo artificialmente ese respaldo.

**22.** Base normal: no utilizada ni modificada. Solo el contenedor MySQL 8.4.8 TEST, puerto 20378, base compartida de evidencia en modo lectura y bases propias de las suites.

**23.** No hubo llamadas a Recurrente, nuevos pagos reales, checkout reales, replay, tarjetas ni prueba manual HU16. Las pruebas financieras usan fixtures/mocks en sus bases propias. No se inspeccionaron o imprimieron valores de Secret Key/Webhook Secret y `.env` permanece sin cambios.

**24.** No hubo commit, push, merge ni creación de ramas. Staging continúa vacío y se conservaron los demás cambios preexistentes.

La validación automatizada solicitada terminó con **0 fallos en todas las suites**. La prueba manual de HU16 permanece pendiente de autorización.
