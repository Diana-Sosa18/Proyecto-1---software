# HU16 — Comprobantes de pago reales

Implementación limitada a HU16, responsable Emilio, 3 Story Points. Validación automatizada final: 2026-10-03. Prueba manual pendiente de autorización. HU17–HU19 no se implementaron.

HU16 utiliza los pagos ya confirmados localmente por HU14. No realiza consultas a Recurrente y no genera ni confirma pagos. Las suites propias de HU16 pasaron; la regresión completa tiene un pendiente en la prueba de respaldo/restauración de Phase 0 descrito abajo.

**Actualización 2026-10-03:** el pendiente de la validación inicial quedó resuelto mediante aislamiento de suites, conservando el límite funcional de 2 MiB y toda la evidencia original. Phase 0 pasó dos veces consecutivas sobre la misma base temporal; todas las suites terminaron con 0 fallos. El diagnóstico, archivos y resultados actuales están en [recurrente-fase0-aislamiento-tests.md](recurrente-fase0-aislamiento-tests.md). Los resultados y el fallo descritos más abajo documentan la corrida original de HU16, previa a esta corrección. La prueba manual todavía no se ejecutó.

## 1. Diseño final

Se amplió el servicio de comprobantes y el generador PDFKit existentes. Un mismo DTO validado alimenta el JSON, el catálogo de comprobantes y el PDF. La vista del residente consulta ese DTO y descarga el PDF generado por el backend. Todo el flujo de comprobantes es de lectura; no tiene operaciones de creación, confirmación o replay.

## 2. Fuente de verdad

La cadena autoritativa es `PAGO` → `PAGO_ORIGEN` → `TRANSACCION_RECURRENTE` → `CHECKOUT_RECURRENTE`, con `CUOTA`, `CASA`, `RESIDENTE`, `USUARIO` y `SERVICIO` para concepto y autorización. Para un comprobante Recurrente se exige:

- Origen RECURRENTE y ambiente coherente.
- Transacción CONFIRMADA, fecha de confirmación y `id_pago` válido.
- Checkout CONFIRMADO, con estado proveedor almacenado `paid`.
- Coincidencia de pago, cuota, casa, usuario de la operación, checkout, ambiente y moneda GTQ.
- Importe positivo en centavos enteros, igual al PAGO y al monto autorizado del checkout.
- Capital aplicado + recargo aplicado igual al importe confirmado, sin valores negativos o ausentes.
- Referencias externas con el formato seguro de HU14 y fecha contable almacenada en PAGO.

Se reutiliza `toCents` de Phase 0; no se recalculan ni modifican aplicaciones financieras. La fecha proviene de `PAGO.fecha_pago`, que HU14 convirtió a America/Guatemala. Consultar el comprobante no cambia esa fecha.

## 3. Numeración

Se conserva la política existente: `NXR-` + `id_pago` con al menos ocho dígitos. El PAGO 395 produce siempre **NXR-00000395**. La PK de PAGO proporciona unicidad; no hay una segunda secuencia ni registros adicionales de comprobantes.

## 4. Datos mostrados

Número, fecha contable, estado, monto Q con dos decimales, moneda GTQ, concepto, residente/titular, unidad, proveedor Recurrente, referencia externa del intent y referencias internas de PAGO/transacción/checkout. La API también devuelve la referencia externa de pago almacenada. Sandbox se identifica explícitamente como **Sandbox / Prueba** en la vista y en el PDF. Se excluyen credenciales, firmas, checkout URL, payloads completos, PAN/CVC y correo innecesario de los comprobantes Recurrente.

## 5. Endpoints

| Método | Ruta | Resultado |
| --- | --- | --- |
| GET | `/residente/pagos/recurrente/comprobantes` | Catálogo de comprobantes Recurrente confirmados del residente autenticado. |
| GET | `/residente/pagos/:paymentId/comprobante/datos` | DTO del comprobante autorizado por PAGO. |
| GET | `/residente/pagos/recurrente/transacciones/:transactionId/comprobante` | DTO por transacción; 409 si no existe aplicación financiera confirmada. |
| GET | `/residente/pagos/:paymentId/comprobante` | PDF; se conserva la ruta previa. |
| GET | `/inquilino/pagos/:paymentId/comprobante` | PDF histórico existente con los permisos previos; no se amplió el rol. |

Las respuestas correctas utilizan `Cache-Control: private, no-store`. No hay un endpoint para crear comprobantes ni se utiliza el cliente Recurrente en este servicio.

## 6. Autorización

Las nuevas rutas usan `requireResidentSession`: Bearer firmado, sesión activa y usuario/rol actuales del backend. El servicio limita la consulta mediante JOIN a la casa del residente autenticado. Las rutas PDF existentes conservan sus middlewares actuales; fuera de los tests también utilizan sesión autenticada y la misma consulta autorizada. No se agregaron permisos administrativos.

## 7. Protección IDOR

La identidad se toma de `req.authUser`, nunca de query, body, email o un ID de residente arbitrario. SQL parametrizado une PAGO/cuota/casa con el residente de esa identidad. Un pago o transacción ajenos devuelve 404 sin revelar su contenido. Las nuevas rutas rechazan cabeceras `x-user-id`/`x-user-role` falsificadas incluso en tests. Los identificadores inválidos se rechazan antes de SQL.

## 8. Operaciones no confirmadas

FALLIDA, CANCELADA, PENDIENTE, sin `id_pago`, checkout `unpaid` o relaciones/importes inconsistentes no pueden emitir un comprobante Recurrente. El endpoint por transacción devuelve 409 `RECEIPT_NOT_CONFIRMED`; el catálogo las excluye; el generador PDF no se invoca si la consulta falla. No basta con retornar del navegador, tener un webhook o tener un checkout.

La evidencia real negativa se mantiene: cuota 998 → checkout 937 `PENDIENTE/unpaid` → transacción 486 `FALLIDA`, `id_pago=NULL`, 0 PAGO. Las pruebas MySQL consultan estos registros sin alterarlos y comprueban el rechazo HTTP 409.

## 9. Visualización

Estado de cuenta presenta “Comprobantes de pagos confirmados” cuando hay abonos registrados y consulta el catálogo local. El catálogo solo ofrece comprobantes reales confirmados y se actualiza al cambiar el total abonado. “Ver comprobante” abre `/residente/pagos/:paymentId/comprobante`, una ruta protegida del residente.

La vista maneja carga, datos correctos, ID inválido, 401, 403, 404, 409 y errores generales. Los mensajes son de un catálogo local seguro; no presenta mensajes crudos, causas ni stack traces del proveedor/backend. Mantiene un botón para volver al Estado de cuenta.

## 10. Descarga PDF

“Descargar PDF” envía únicamente el ID del PAGO. El backend vuelve a obtener y validar todos los datos; utiliza PDFKit existente. El nombre es `comprobante-NXR-00000395.pdf` para el caso real. La descarga muestra carga y bloquea el doble clic. Se reutiliza `savePaymentReceipt` para guardar el Blob. El PDF muestra los mismos datos autoritativos y conserva referencias extensas sin truncarlas.

## 11. Archivos creados

Rutas relativas a `proyecyo-1/`:

- `backend/src/services/__tests__/paymentReceipt.hu16.test.js`
- `backend/src/routes/__tests__/paymentReceipt.hu16.routes.test.js`
- `backend/test/integration/hu16.mysql.test.js`
- `backend/test/integration/support/receiptPdfText.js`
- `frontend/src/types/paymentReceipt.ts`
- `frontend/src/components/payments/RecurrenteReceipts.tsx`
- `frontend/src/components/payments/RecurrenteReceipts.test.tsx`
- `frontend/src/views/ResidentePaymentReceiptView.tsx`
- `frontend/src/views/ResidentePaymentReceiptView.test.tsx`
- `frontend/src/services/paymentReceipt.hu16.test.ts`
- `docs/recurrente-hu16.md`

## 12. Archivos modificados

- `backend/src/services/paymentReceiptService.js`: consulta autorizada, validación de asociación, DTO, catálogo y PDF.
- `backend/src/controllers/paymentReceiptController.js`: handlers de consulta/catálogo y descarga desde el mismo servicio.
- `backend/src/routes/paymentReceiptRoutes.js`: tres GET autenticados; conserva las rutas PDF existentes.
- `backend/package.json`: script `test:hu16:mysql`.
- `frontend/src/services/paymentReceiptService.ts`: GET JSON/catálogo/PDF, mensajes seguros; conserva la utilidad de guardado.
- `frontend/src/routes/AppRouter.tsx`: ruta protegida del comprobante.
- `frontend/src/views/ResidenteAccountView.tsx`: acceso al catálogo, sin cambiar el flujo Pagar HU13.
- `frontend/src/views/ResidentePaymentReturnView.test.tsx`: mock del catálogo para mantener las pruebas previas sin red.

La comparación SHA-256 con el inventario previo a HU16 encontró únicamente estos ocho archivos modificados y los once archivos creados de HU16. No se eliminaron archivos. Los demás cambios preexistentes siguen presentes; el diff global de Git incluye Phase 0/HU13/HU14/HU15 y no debe atribuirse íntegramente a HU16.

## 13. Migraciones y dependencias

Ninguna migración ni tabla nueva. Se deriva el comprobante de las relaciones existentes. Las migraciones 001/002/003/004 no cambiaron. No se instalaron dependencias ni se modificó el lockfile por HU16. PDFKit ya estaba disponible. No hay una entidad nueva que agregar a backup/restore.

## 14–23. Resultados de validación

Motor: MySQL TEST 8.4.8, contenedor `nexus-phase0-test-20261001-a9a8f83b`, base `nexus_phase0_test_20261001_a9a8f83b`, host `127.0.0.1`, puerto `20378`.

| Punto | Suite/comando | Aprobadas | Fallidas | Omitidas |
| --- | --- | ---: | ---: | ---: |
| 14 | Backend completo: `npm.cmd test` | 552 | 0 | 0 |
| 15 | `npm.cmd run test:phase0:mysql` | 24 | 1 | 0 |
| 16 | `npm.cmd run test:hu13:mysql` | 27 | 0 | 0 |
| 17 | `npm.cmd run test:hu14:mysql` | 74 | 0 | 0 |
| 18 | `npm.cmd run test:hu15:mysql` | 54 | 0 | 0 |
| 19 | `npm.cmd run test:hu16:mysql` | 30 | 0 | 0 |
| 20 | `npm.cmd run test:phase0:functional` | 12 | 0 | 0 |
| 21 | Frontend completo: `npm.cmd run test:run -- --maxWorkers=2` | 137 | 0 | 0 |

Backend: 93 pruebas Node + 459 pruebas Jest, 47 suites Jest. Frontend: 42 archivos de pruebas. HU16 agregó 55 pruebas unitarias/HTTP backend, 30 MySQL y 16 frontend; cubren PAGO 395, sus datos reales y PDF, acceso horizontal, falta de sesión, roles/sesión revocada, inconsistencias, estados no confirmados y lectura/descarga repetida sin cambios financieros.

**22. Build:** `npm.cmd run build` exitoso, 2379 módulos; conserva la advertencia de bundle mayor a 500 kB. No se publicó ni desplegó.

**23. Diff:** `git diff --check` exit 0; staging vacío, 0 archivos. Ningún `.env` real está versionado. `git diff --stat` global: 50 archivos versionados modificados, 649 inserciones y 243 eliminaciones; no incluye los archivos nuevos sin seguimiento y sí incluye cambios anteriores a HU16.

La primera corrida completa del frontend sufrió una interrupción prolongada del entorno y terminó con 8 tests fallidos/112 aprobados y 10 errores de workers, sin completar las 42 suites. Se repitió sin cambiar código y con dos workers: 137/137. No se usó esa primera corrida como validación satisfactoria.

### Pendiente de regresión: respaldo/restauración Phase 0

La prueba “backup y restore real conservan las cinco tablas y referencias compuestas” falla al validar el respaldo completo acumulado de TEST: supera el límite existente de **2,097,152 bytes (2 MB)**. La medición de lectura posterior a esa corrida dio **2,165,332 bytes**. La repetición de Phase 0 reprodujo el mismo fallo.

No es un error de los endpoints de comprobantes. No se aumentó el límite, no se cambió el servicio de respaldos/restauraciones y no se borraron fixtures para obtener un resultado verde. La validación global sigue teniendo este pendiente técnico y debe resolverse de forma explícita antes de declararla totalmente aprobada. La prueba de rollback de restauración sí pasó. HU13/HU14/HU15 y las otras 24 pruebas MySQL de Phase 0 pasaron.

## 24–26. Evidencia financiera preservada

Se compararon todas las columnas de los registros protegidos contra una captura inicial: CUOTA 171/998; todos sus PAGO, PAGO_ORIGEN, TRANSACCION_RECURRENTE y CHECKOUT_RECURRENTE; EVENTO_RECURRENTE 348/349/859/860. **Todos permanecen iguales.**

| Evidencia | Resultado final |
| --- | --- |
| 24: PAGO 395 | Único PAGO de cuota 171; Q5.00; fecha 2026-10-02; origen RECURRENTE/sandbox. |
| Transacción 296 | CONFIRMADA; `id_pago=395`; checkout 433. |
| Checkout 433 | CONFIRMADO / paid. |
| 25: Cuota 171 | Capital Q5.00, pagado Q5.00, saldo real **Q0.00**. |
| 26: Cuota 998 | Capital Q5.00, pagado Q0.00, saldo real **Q5.00**, exactamente **0 PAGO**. |
| Transacción 486 | FALLIDA, `id_pago=NULL`. |
| Checkout 937 | PENDIENTE / unpaid. |

La consulta y descarga repetidas se probaron sobre el PAGO 395 en servidores HTTP efímeros de tests vinculados a 127.0.0.1. No generaron otro abono, transacción, cambio de saldo o procesamiento de webhook. Las suites de regresión crearon sus fixtures TEST independientes; no realizaron pagos reales ni modificaron la evidencia manual. La base normal no se utilizó.

## 27–29. Seguridad y restricciones

**27.** No se llamó a Recurrente. Los tests de integración de comprobantes bloquean fetch externo y solo permiten el servidor de tests en 127.0.0.1. No se realizaron pagos, checkout reales, replay, uso de tarjeta ni registro de webhook.

**28.** No se inspeccionaron ni imprimieron valores de Secret Key o Webhook Secret. No se introdujeron secretos reales en los archivos HU16, respuestas o PDF. Las credenciales están vacías en las suites antes de importar la aplicación. `backend/.env` no se editó ni copió; sus metadatos permanecen iguales y está ignorado por Git. La revisión de literales de secretos en los archivos HU16 no encontró coincidencias.

**29.** No hubo commit, push, merge ni creación de rama. Staging continúa vacío. Los cambios previos se preservaron. No se administró ngrok ni se reinició el backend manual para hacer esta prueba.

## 30. Prueba manual mínima propuesta — NO ejecutada

Cuando el usuario autorice la prueba y el backend manual cargue la versión HU16 sobre la misma infraestructura TEST:

1. Abrir `http://127.0.0.1:5174/login` e iniciar sesión como `residente@test.com`.
2. Ir a Estado de cuenta y buscar la sección **Comprobantes de pagos confirmados**.
3. Seleccionar **Ver comprobante** del concepto **HU13 Sandbox Q5 TEST**, número **NXR-00000395**. También puede abrirse directamente `http://127.0.0.1:5174/residente/pagos/395/comprobante` después del login.
4. Verificar Q5.00, fecha 2026-10-02, Confirmado, GTQ, Recurrente, Residente Demo, B-302, intent `in_y4hil51d` y referencia interna Pago 395 / Transacción 296 / Checkout 433. Debe verse **Sandbox / Prueba**.
5. Pulsar **Descargar PDF**, abrir el archivo y comprobar esos mismos datos y la marca Sandbox. Descargar nuevamente debe conservar el número.
6. Como comprobación negativa, cuota 998 no debe ofrecer un comprobante confirmado. No pulsar Pagar ni Verificar y continuar pago.

Esta prueba solo consulta datos ya confirmados. No requiere otro pago, checkout, tarjeta, replay o comunicación con Recurrente. Se espera autorización antes de realizarla.
