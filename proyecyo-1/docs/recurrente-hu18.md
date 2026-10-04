# HU18 — Reembolsos totales de Recurrente

Implementación para Sprint 9. Validada con proveedor mock, firmas Svix TEST y MySQL aislado. **La validación manual del reembolso total en Sandbox quedó cerrada el 2026-10-04; véase la sección 15.** No se habilitan producción, reembolsos parciales ni anulaciones.

## 1. Contrato oficial y límites

El cliente backend usa `https://app.recurrente.com/api`, autenticación `X-SECRET-KEY` obtenida únicamente del entorno y JSON. No hay credenciales nuevas, dependencias nuevas ni secretos almacenados en la base o enviados al frontend.

| Operación | Contrato utilizado |
| --- | --- |
| Verificar credenciales | `GET /test`: exige `environment=sandbox`, Sandbox ID configurado y `account_id` válido |
| Verificar pago original | `GET /intents/in_*` y `GET /checkouts/ch_*` |
| Solicitar devolución total | `POST /refunds`, cuerpo **únicamente** `{ "intent_id": "in_*" }`, header `Idempotency-Key` |
| Consultar devolución conocida | `GET /refunds/re_*` |
| Evento | `refund.create`; conserva el receptor existente `/webhooks/recurrente` |

Se omite `amount_in_cents`: el contrato oficial indica devolución del saldo reembolsable completo. La API local tampoco acepta un monto parcial. El motivo administrativo se conserva solo localmente. Véase [crear refund](https://docs.recurrente.com/referencia-api/api-reference/refunds/create-refund).

`in_*` identifica el intent canónico. El `pa_*` de `payment_intent_id`/`intentable` representa el intent antiguo, mientras que otro `pa_*` puede identificar el pago físico. Nunca se intercambian por compartir prefijo. Se usa el intent canónico persistido para POST y la asociación histórica validada para webhooks. Véanse [consultar intent](https://docs.recurrente.com/referencia-api/api-reference/intents/get-intent) y [evento refund.create](https://docs.recurrente.com/referencia-api/api-reference/webhook-events/refund-create-webhook).

El monto financiero es `customer_refunded_amount_in_cents`. `account_refunded_amount_in_cents` puede diferir por comisiones; se guarda como auditoría y nunca decide la deuda del residente. La confirmación exige status `succeeded`, referencia, monto cliente, GTQ, fecha oficial y contexto coherentes. Un HTTP 200 no es confirmación por sí mismo. Los estados normalizados del proveedor son `pending`, `succeeded`, `failed` y `voided`. Véase [consultar refund](https://docs.recurrente.com/referencia-api/api-reference/refunds/get-refund).

El preflight comprueba la ventana documentada de 30 días desde la fecha oficial verificable del intent; fecha ausente, futura o fuera de ventana impide POST. Las restricciones de saldo de cuenta y tarjeta financiada no tienen evidencia suficiente en el contrato normalizado público utilizado: las aplica el proveedor. No se inventan atributos para afirmar que fueron comprobadas. Véase [ayuda oficial de reembolsos](https://ayuda.recurrente.com/es/p/como-puedo-reembolsar-un-pago-a-un-cliente).

No se inventa `GET /refunds` general. Consultar referencias conocidas no demuestra ausencia de devoluciones externas desconocidas. HU17 comunica expresamente **cobertura incompleta**.

### Anulación

Recurrente documenta `POST /refunds/{id}/void`, que anula **un refund**, no el pago original. Su elegibilidad concreta y comportamiento Sandbox requieren validación adicional. Por la política aprobada, no hay ruta local ni botón para esta operación. Un status externo `voided` exige revisión; no se inventa una reversión contable. Esta investigación/documentación cumple la subtarea 4 dentro del alcance aprobado. Véase [void de refund](https://docs.recurrente.com/referencia-api/api-reference/refunds/void-refund).

## 2. Endpoints y autorización

| Método y ruta | Función | Llamadas proveedor |
| --- | --- | --- |
| `GET /admin/pagos/recurrente/:transactionId/refund-eligibility` | Snapshot local de elegibilidad, asociaciones, importes e historial | Ninguna |
| `GET /admin/pagos/recurrente/:transactionId/refunds` | Historial local | Ninguna |
| `POST /admin/pagos/recurrente/:transactionId/refunds` | Reserva y solicitud total explícita | GET test, GET intent, GET checkout y un POST refund |
| `POST /admin/pagos/recurrente/reembolsos/:refundId/verificar` | Verificar referencia externa ya vinculada | GET test y GET refund; ningún POST financiero |

El POST de solicitud acepta exclusivamente `{ motivo, idempotency_key }`. La clave es un UUID; el motivo es obligatorio, normalizado y de hasta 500 caracteres. Rechaza campos adicionales, controles, HTML, patrones de tarjeta y nombres/prefijos reconocibles de credenciales. Las respuestas usan un catálogo seguro; no incluyen body arbitrario, headers, causas internas ni datos de tarjeta del proveedor.

Todas las rutas usan `requireAdminSession`: token firmado, sesión activa y rol actual consultado en BD. La reserva verifica nuevamente ADMIN activo. Un residente, token manipulado, sesión revocada o headers de rol fabricados no llegan al cliente financiero.

## 3. Elegibilidad

La consulta local distingue elegibilidad preliminar de la verificación externa obligatoria al solicitar. Exige:

- PAGO histórico existente, origen RECURRENTE/Sandbox e `id_pago` coherente.
- Transacción históricamente confirmada, con fecha y aplicación original de capital/recargos válida.
- Checkout original `CONFIRMADO/paid` y asociaciones cuota, usuario, residente y casa coherentes.
- Intent canónico `in_*`, pago físico `pa_*`, checkout `ch_*`, importe positivo y GTQ.
- Sandbox correcto, disponible positivo y estado agregado consistente con los refunds aplicados.
- Ausencia de refund reservado, operación incierta/revisión, evidencia externa desconocida correlacionada o checkout incompatible activo.
- Balance común sin sobrepago ni refund superior al cobrado.

Antes del POST, el cliente verifica credenciales, contexto de cuenta, intent exitoso, checkout paid, importes, moneda, referencias, modo no productivo cuando está presente y ventana temporal. Una transacción FALLIDA —incluida la 486— no es elegible.

## 4. Modelo contable común

```text
Cobrado bruto = suma histórica de PAGO confirmados
Devuelto = suma de REEMBOLSO_RECURRENTE con estado CONFIRMADO y aplicado_en no nulo
Abono neto = cobrado bruto - devuelto
Recargo pendiente = recargos registrados - aplicación del abono neto a recargos
Capital pendiente = capital - aplicación restante del abono neto a capital
Saldo actual = recargo pendiente + capital pendiente
```

La distribución es global por cuota: **recargos primero, capital después**. No reescribe las aplicaciones históricas de transacciones originales. Los deltas de deuda reabierta se registran en el refund como `capital_revertido_centavos` y `recargo_revertido_centavos`. Estos deltas pueden diferir de la aplicación del PAGO devuelto cuando existen otros pagos; representan el cambio global actual.

| Ejemplo | Resultado |
| --- | --- |
| Cuota Q5, PAGO Q5, refund total Q5 | Bruto Q5, devuelto Q5, neto Q0, saldo Q5 |
| Capital Q100, recargos Q15, pagos Q50 + Q65; devolver el PAGO Q50 | Bruto Q115, devuelto Q50, neto Q65; recargos pendientes Q0, capital pendiente Q50 |
| Capital Q100, recargos Q15, PAGO Q115; devolver Q115 | Capital pendiente Q100, recargos pendientes Q15, saldo Q115 |

Un refund pendiente, incierto, solicitado o en revisión no disminuye el crédito ni aumenta el saldo: **reserva** importe y bloquea acciones incompatibles. El sobrepago histórico se conserva como anomalía explícita; un devuelto superior al bruto se rechaza, no produce un saldo negativo silencioso.

La deuda se reabre en la misma CUOTA: conserva concepto y vencimiento. Si está vencida, vuelve a las reglas habituales de mora. El aplicador no inserta recargos. Las reglas normales mantienen la idempotencia de `RECARGO_APLICADO`; existe prueba con dos ejecuciones posteriores y un solo recargo histórico.

Los filtros de fechas seleccionan movimientos, no los abonos ni refunds acumulados del balance. El neto de caja de un período puede ser negativo cuando se devuelve en ese período un pago anterior; esto se presenta como flujo de caja, no como deuda negativa.

### Consultas adaptadas

`backend/src/services/financialBalance.js` agrega `REFUND_TOTALS_SQL`, `refundedQuotaSql`, bruto/devuelto/neto y el saldo común en centavos/DECIMAL exacto. La suma SQL convierte explícitamente a `DECIMAL(20,2)`. `QUOTA_BALANCES_SQL` incluye una señal de inconsistencia si el devuelto supera los pagos.

Se adaptaron las sumas directas en `residentAccountService.js`, `tenantAccountService.js`, `residentFinancialDetailService.js`, `adminPaymentsService.js`, `adminSanctionsService.js`, `recurrenteCheckoutService.js`, `recurrenteWebhookService.js` y `simulatedPaymentsService.js`. La mora administrativa usa el capital pendiente del SQL común: con capital Q100, recargos Q15 y neto Q100 quedan Q15 de capital pendientes; no interpreta el neto Q100 como capital completamente pagado. Las reglas y recordatorios usan el SQL común y excluyen anomalías. Los consumidores existentes `reportExportService.js`, `financialRulesService.js`, `adminRemindersService.js` y HU17 reciben el cálculo neto mediante el mismo SQL.

Los listados de movimientos muestran refunds confirmados/aplicados por fecha contable. Los resúmenes históricos mantienen `pagado`/`total_cobrado` como bruto y agregan devuelto/neto por separado; no cambian silenciosamente el significado de ingresos históricos. Las vistas de residente e inquilino usan abono neto para progreso/saldo y conservan el bruto como historial.

## 5. Persistencia, migración 005 y esquema final

`backend/sql/migrations/005_recurrente_refunds.sql` amplía únicamente `REEMBOLSO_RECURRENTE`; no crea tablas ni modifica datos existentes. No hay DROP TABLE, DROP COLUMN, DELETE, TRUNCATE ni backfill financiero. Las columnas nuevas son nullable para preservar fixtures/históricos anteriores sin convertirlos en refunds aplicados.

Cada columna, índice y restricción se prepara condicionalmente con `information_schema` y el patrón PREPARE/EXECUTE existente. Se sustituye el CHECK antiguo de estados por un CHECK que conserva todos los estados anteriores y agrega INCIERTO/REVISION. Ese DROP CHECK no elimina columnas ni filas. La aplicación repetida está probada.

| Columna final | Tipo | Procedencia / propósito |
| --- | --- | --- |
| id_reembolso | BIGINT UNSIGNED PK AUTO_INCREMENT | 001, identidad local |
| id_transaccion | BIGINT UNSIGNED NOT NULL | 001, transacción original |
| id_externo | VARCHAR(191) ascii_bin NULL | 001, refund re_* |
| idempotency_key | VARCHAR(128) ascii_bin NOT NULL | 001, UUID de solicitud |
| id_usuario_solicitante | INT NOT NULL | 001, ADMIN real |
| monto_centavos | BIGINT UNSIGNED NOT NULL | 001, importe cliente autorizado |
| moneda | CHAR(3) ascii_bin NOT NULL | 001, GTQ en HU18 |
| ambiente | VARCHAR(10) NOT NULL | 001, sandbox en HU18 |
| tipo | VARCHAR(7) NOT NULL | 001, TOTAL en HU18; PARCIAL histórico preservado |
| estado | VARCHAR(12) NOT NULL DEFAULT SOLICITADO | 001 + CHECK ampliado 005 |
| error_codigo | VARCHAR(80) NULL | 001, código permitido |
| error_sanitizado | VARCHAR(500) NULL | 001, conservado; HU18 no persiste texto arbitrario |
| creado_en | DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) | 001, recepción de solicitud local |
| actualizado_en | DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) | 001 |
| confirmado_en | DATETIME(6) NULL | 001, confirmación local |
| referencia_local | CHAR(36) ascii_bin NULL | 005, UUID local opaco |
| request_fingerprint | CHAR(64) ascii_bin NULL | 005, SHA-256 del request autorizado y asociaciones |
| motivo | VARCHAR(500) NULL | 005, motivo local obligatorio para solicitudes HU18 |
| sandbox_id | VARCHAR(191) ascii_bin NULL | 005, contexto Sandbox |
| estado_proveedor | VARCHAR(12) ascii_bin NULL | 005, resultado externo |
| enviado_en | DATETIME(6) NULL | 005, marcador previo a POST |
| verificado_en | DATETIME(6) NULL | 005, verificación del refund, no del checkout HU15 |
| fecha_proveedor_original | VARCHAR(40) ascii_bin NULL | 005, timestamp original del proveedor |
| fecha_proveedor_utc | DATETIME(6) NULL | 005, timestamp normalizado UTC |
| fecha_contable | DATE NULL | 005, America/Guatemala, solo al confirmar |
| aplicado_en | DATETIME(6) NULL | 005, marcador de aplicación financiera única |
| capital_revertido_centavos | BIGINT UNSIGNED NULL | 005, delta global de capital pendiente |
| recargo_revertido_centavos | BIGINT UNSIGNED NULL | 005, delta global de recargos pendientes |
| id_evento | BIGINT UNSIGNED NULL | 005, vinculación al inbox |
| evidencia_confirmacion | VARCHAR(8) ascii_bin NULL | 005, POST / GET / WEBHOOK |
| importe_comercio_centavos | BIGINT UNSIGNED NULL | 005, auditoría; no decide saldo |
| cuenta_proveedor | VARCHAR(191) ascii_bin NULL | 005, cuenta validada por GET test |

Se conservan `uq_reembolso_externo (ambiente,id_externo)` y `uq_reembolso_idempotencia (ambiente,idempotency_key)`. Se agrega `uq_refund_reference_hu18 (referencia_local)`.

Se conservan las FK a `TRANSACCION_RECURRENTE(id_transaccion,ambiente,moneda)` y `USUARIO(id_usuario_solicitante)`. Se agrega `fk_refund_event_hu18 (id_evento,ambiente) -> EVENTO_RECURRENTE(id_evento,ambiente)`. No se necesita ampliar EVENTO: se reutilizan `id_checkout`, `id_operacion_externa`, hash y metadatos existentes.

Los CHECK existentes siguen limitando importe positivo y entero seguro, ambientes y tipos. Los cuatro nuevos CHECK son `chk_refund_state_hu18`, `chk_refund_provider_hu18`, `chk_refund_application_hu18` y `chk_refund_evidence_hu18`. El de aplicación exige: sin marcador no hay deltas; con marcador el estado es CONFIRMADO, hay fecha/confirmación y ambos deltas suman el importe autorizado. Las validaciones adicionales de contrato, motivo, fechas y asociaciones se realizan en el servicio.

005 se integra en `recurrenteMigration.js`, `server.js`, `scripts/migrate-recurrente.js`, el arranque Sandbox existente y la preparación de las bases temporales del runner. **No se ejecutó el arranque manual ni se aplicó 005 sobre la base TEST compartida durante esta implementación.**

### Backup/restore

`backend/src/database/backupTables.js` ya incluía REEMBOLSO, EVENTO y todas sus dependencias desde Fase 0. El exportador obtiene columnas reales y el restaurador conserva esquema, FK y campos: no fue necesario agregar otra tabla ni eliminar soporte anterior. La prueba HU18 exporta/restaura un refund aplicado en otra base temporal y comprueba importes, fecha, marcador, evidencia e integridad referencial.

## 6. Estados e idempotencia

| Estado local refund | Efecto financiero | Reserva / acción |
| --- | --- | --- |
| SOLICITADO | Ninguno | Reserva antes del HTTP |
| INCIERTO | Ninguno | Reserva indefinida; jamás POST automático |
| PENDIENTE | Ninguno | Reserva; GET conocido o webhook suficiente |
| REVISION | Ninguno nuevo | Bloquea; resolución segura |
| CONFIRMADO + aplicado_en | Resta del crédito histórico una sola vez | Conserva historial y marcador |
| FALLIDO definitivo | Ninguno | Libera; nueva solicitud requiere acción ADMIN explícita |
| CANCELADO | Estado histórico preservado | No existe operación de cancelación habilitada |

Un CONFIRMADO histórico sin `aplicado_en` **no se descuenta** del crédito: conserva reserva/bloqueo para revisión. Una contradicción posterior a un refund ya aplicado conserva la aplicación y agrega la señal de revisión; no la revierte por suposición.

La transacción original conserva `id_pago`, referencias, monto, fecha y aplicaciones. Su estado agregado pasa de CONFIRMADA a REEMBOLSADA o REEMBOLSADA_PARCIAL según refunds aplicados. El checkout original conserva CONFIRMADO/paid: el pago ocurrió y posteriormente fue devuelto. La cuota conserva el registro original; su estado se calcula usando saldo neto y vencimiento.

La solicitud reserva el máximo bajo bloqueo de **cuota -> checkout -> transacción -> refunds**, con READ COMMITTED. Comprueba el límite acumulado confirmado + reservado <= pago original. El fingerprint incorpora actor, motivo normalizado, identidad canónica, asociaciones, importe original, importe autorizado, GTQ y Sandbox. La misma clave y fingerprint recuperan la fila existente sin otro POST; una variación da conflicto.

La reserva se confirma en SQL antes del HTTP. Justo antes del POST se confirma el marcador INCIERTO/enviado y la cuenta validada. **No se mantienen locks SQL durante llamadas HTTP.** Si cae el proceso entre ese marcador y la respuesta, la reserva sigue bloqueada.

POST, GET y webhook usan `applyRefundEvidence` en una transacción SQL. Bloqueos, UNIQUE externo y `aplicado_en` impiden doble aplicación. Se validan todos los importes antes de guardar refund y estado agregado conjuntamente. Un fallo intermedio revierte ambos; la reserva permanece, con referencia externa conocida cuando puede conservarse de forma segura.

Timeout, 5xx, pérdida de respuesta, contrato inválido y 422 con `refund_id`/resultado desconocido no desencadenan otro POST. 202 es PENDIENTE aunque el body diga succeeded. Un rechazo 4xx inequívoco —incluido 429 sin evidencia de operación creada— es FALLIDO; no hay retry automático. La misma clave nunca vuelve a enviarse para resolver incertidumbre. Para un nuevo intento tras rechazo definitivo, el administrador consulta nuevamente la elegibilidad y confirma una nueva solicitud.

## 7. Webhook y evidencia insuficiente

Se mantienen el raw body original, la biblioteca Svix, validación de firma, inbox durable, hash y UNIQUE por svix-id/ambiente. `refund.create` se normaliza por allowlist; no se guarda customer, tarjeta, payload completo ni texto arbitrario de fallo.

El ejemplo oficial de `refund.create` no publica `live_mode` ni `sandbox_id`. No se asumen estos valores. Un evento sin evidencia explícita suficiente queda en REVISION, sin asiento; una referencia conocida puede verificarse por GET autenticado en el Sandbox validado. Véase [contrato oficial del evento](https://docs.recurrente.com/referencia-api/api-reference/webhook-events/refund-create-webhook).

El contrato observado en Sandbox también sitúa `live_mode` en `intentable` y en `intentable.checkout`. El normalizador examina raíz, refund, intentable y checkout. Todas las fuentes presentes deben ser booleanas y coincidir: una mezcla true/false devuelve `REFUND_ENVIRONMENT_CONFLICT`; ausencia o valores no booleanos devuelven `REFUND_ENVIRONMENT_UNPROVEN`. True consistente identifica producción, que permanece prohibida en esta versión. Sandbox exige false explícito y el sandbox_id configurado; los sandbox_id adicionales presentes también deben coincidir.

La asociación de un refund con su evento adquiere primero los bloqueos cuota -> checkout -> transacción, antes de actualizar la FK del inbox. Esto evita invertir el orden de bloqueos en entregas simultáneas.

La recuperación local de `refund.create` reutiliza el mecanismo de REVISION, sin enviar un webhook nuevo. Una recepción histórica con live_mode NULL solo es admisible cuando su error es `REFUND_ENVIRONMENT_UNPROVEN` y los bytes originales, cuyo SHA-256 coincide con la recepción ya verificada por Svix, ahora demuestran Sandbox inequívocamente. El dry-run exige refund conocido CONFIRMADO/succeeded/aplicado, importe, moneda, fecha y referencias coherentes con transacción, PAGO, cuota y checkout. No admite aplicar una reserva pendiente mediante esta recuperación. El apply vuelve a validar dentro de la transacción, archiva la revisión mediante INSERT ... SELECT (SQL -> SQL, DATETIME(6)) y usa el aplicador existente para reconocer duplicate sin alterar finanzas. Solo se libera el bloqueo del evento resuelto; otras revisiones siguen bloqueando.

Fixture sanitizado: `backend/test/fixtures/recurrente-refund-create-observed.json`, con estructura anidada observada e identificadores ficticios. Las pruebas del normalizador cubren A–M, modos no booleanos y Sandbox anidado contradictorio. MySQL comprueba entregas concurrentes, recuperación repetida/concurrente, dry-run de solo lectura, referencias contradictorias, SHA diferente, reserva no aplicada, rollback, preservación exacta de microsegundos y backup/restore de la revisión.

Para aplicar un webhook se exige refund externo ya vinculado, parent intent histórico exacto, Sandbox/mode explícitos coherentes, cuenta previamente validada, importe cliente, moneda y fecha suficientes. La asociación no usa solo el monto ni confunde el parent pa_* con el pago físico.

Si el evento se adelanta a la persistencia de la respuesta POST, la identidad del parent no demuestra qué solicitud creó el refund: el inbox queda reintentable y responde 503. Tras la vinculación autoritativa, la entrega posterior puede aplicar. Si la respuesta se perdió y no hay ID seguro, no se adivina: se mantiene bloqueado para revisión.

Un refund externo desconocido queda en REVISION, vinculado al checkout cuando el parent es inequívoco. No se inventa ADMIN ni fila financiera. La cuota correlacionada queda bloqueada. Si falta toda correlación no puede identificarse una cuota específica para bloquear; se conserva la evidencia en el inbox para revisión, sin asociación por monto.

El caso sin refund ID conserva el inbox con identificador externo NULL y revisión. Distintos svix-id de un mismo refund, replay del mismo mensaje, HTTP antes/después de webhook y concurrencia GET/webhook no duplican la devolución. Un éxito original tardío de HU14 reconoce el PAGO histórico y conserva REEMBOLSADA; no registra otro abono.

## 8. HU16, HU17 y frontend

HU16 mantiene el comprobante original permanente: mismo número, fecha y bruto. La consulta, listado y PDF admiten transacciones históricamente confirmadas que ahora estén REEMBOLSADA/REEMBOLSADA_PARCIAL. Agregan devolución posterior, importe devuelto y abono neto; el PDF sigue disponible con neto cero.

HU17 consulta cada refund conocido mediante GET y compara por separado original, devolución, importe cliente, moneda, cuenta cuando está presente, fecha, aplicación y estado agregado. Un refund CONFIRMADO sin referencia, aplicación o fecha externa suficiente permanece PENDIENTE; tres pruebas cubren estos casos sin mutaciones. Informa devuelto/neto y cobertura incompleta. Sigue siendo **solo lectura financiera**: no llama al aplicador ni modifica PAGO, checkout, transacción, refund, evento, saldo o timestamps HU15.

Frontend ADMIN: `/admin/pagos/reembolsos`, opción **Reembolsos de pagos** y enlace desde conciliación. Puede precargar `?transaccion=<id>`. Muestra PAGO/comprobante, cuota, residente, unidad, fecha/vencimiento, original/devuelto/reservado/disponible/neto, estados e historial. Exige motivo y modal con importe completo antes de **Confirmar solicitud**. Ofrece verificación explícita únicamente para refund conocido pendiente/incierto/revisión. No verifica externamente al abrir, no envía POST automáticamente, previene doble clic y mantiene la clave de solicitud durante repeticiones.

## 9. Las 11 subtareas oficiales

| # | Subtarea | Estado de implementación | Evidencia |
| --- | --- | --- | --- |
| 1 | Validar transacciones elegibles | CUMPLIDA | `recurrenteRefundService.js`, preflight de `recurrenteRefundClient.js`; fixtures inelegibles/ventana/Sandbox |
| 2 | Endpoint de reembolso | CUMPLIDA | Cuatro rutas ADMIN; pruebas de rutas y HTTP con sesión real TEST |
| 3 | Integración con pasarela | CUMPLIDA | POST canónico real Sandbox y refund.create observado resuelto idempotentemente; sección 15 |
| 4 | Anulación cuando proveedor la permita | CUMPLIDA conforme al alcance aprobado | Investigación de void de refund y exclusión explícita; ninguna ruta inventada |
| 5 | Permisos administrativos | CUMPLIDA | Token/sesión/rol actual; residente y sesión revocada rechazados |
| 6 | Motivo | CUMPLIDA | Normalización, máximo 500, rechazo de tarjeta/secretos; historial local |
| 7 | Estado de transacción | CUMPLIDA | Agregado REEMBOLSADA* separado del éxito histórico/checkout |
| 8 | Estado de cuenta | CUMPLIDA | Abono neto global, filtros de movimientos, saldo de la misma cuota |
| 9 | Historial | CUMPLIDA | GET local, referencias, motivo, proveedor, fechas y evidencia sin borrar PAGO |
| 10 | Resultado frontend | CUMPLIDA | Modal, importe, loading, doble clic, estados y mensajes seguros |
| 11 | Pruebas | CUMPLIDA | Matriz, regresiones y contrato real anidado; 23 unitarias nuevas y 20 MySQL nuevas; sección 15 |

## 10. Matriz de las 30 pruebas acordadas

U = `backend/src/services/__tests__/recurrenteRefund.hu18.test.js`; R = `backend/src/routes/__tests__/recurrenteRefund.hu18.routes.test.js`; M = `backend/test/integration/hu18.mysql.test.js`; F = los dos archivos frontend HU18 `.test.ts/.test.tsx`.

| # | Escenario | Cobertura |
| --- | --- | --- |
| 1 | Total exitoso | U contrato; M aplicado con reapertura |
| 2 | Parcial | Fuera de alcance: U/R rechazan campos de monto/tipo parcial |
| 3 | Segundo refund | M clave repetida y solicitudes distintas bloqueadas |
| 4 | Exceso sobre disponible | U presupuesto; M reserva/cap bajo bloqueo |
| 5 | Transacción FALLIDA | U; M 486 inelegible y protegida |
| 6 | Transacción CANCELADA | U elegibilidad |
| 7 | Pago no Recurrente | U SIMULADO/HISTORICO |
| 8 | Sin payment externo | U elegibilidad y preflight de IDs |
| 9 | Ambiente incorrecto | U Sandbox/production; M evidencia insuficiente |
| 10 | No ADMIN | R y M sesión de residente real TEST |
| 11 | Sesión revocada | R y M |
| 12 | Doble clic | M solicitudes simultáneas misma clave; F loading |
| 13 | Requests concurrentes | M diferentes claves, locks liberados antes de HTTP |
| 14 | Timeout | U; M reserva incierta sin desbloqueo temporal |
| 15 | 429 | U rechazo definitivo, ningún reenvío |
| 16 | 5xx | U sin retry; M incertidumbre conservada |
| 17 | Respuesta inválida | U; M monto/moneda/fecha/contexto incompatible |
| 18 | Refund failed | M sin contabilidad, nuevo intento ADMIN explícito |
| 19 | Webhook duplicado | M mismo svix-id y distintos svix-id |
| 20 | Webhook antes de HTTP | M inbox reintentable, sin asociación por monto |
| 21 | HTTP antes de webhook | M duplicate, fecha/marcador sin cambios |
| 22 | HTTP/GET/webhook concurrentes | M aplicador compartido y una aplicación |
| 23 | Rollback SQL | M falla entre refund/agregado y recuperación webhook |
| 24 | Saldo posterior | U/M Q5 -> saldo Q5 sin borrar PAGO |
| 25 | Recargos posteriores | M recargos primero, mora y no duplicación |
| 26 | Comprobante permanente | M consulta/listado/PDF y prueba de vista HU16 |
| 27 | Historial | R/M/F motivos, estados y referencias |
| 28 | HU17 posterior | M comparación original/refund con cero escrituras |
| 29 | Cero duplicados | M UNIQUE, claves, webhooks, concurrencia y marcador |
| 30 | Máximo reembolsable | U/M bruto menos aplicado/reservado bajo lock |

También se prueban múltiples pagos, cliente != comercio, fecha Guatemala, parent pa_* != payment pa_*, éxito canónico antes del legacy, éxito original tardío, refund externo desconocido, falta de modo/Sandbox/ID, CONFIRMADO legacy sin marcador, migración inicial/repetida conservando filas, FK/UNIQUE/CHECK reales y backup/restore completo.

## 11. Validación automatizada y entorno

Se usa MySQL 8.4.8 del contenedor TEST existente, 127.0.0.1:20378. El runner recibe la base fuente `nexus_phase0_test_20261001_a9a8f83b` **solo para lectura** y crea bases propias `_run_<token>` y `_restore_<token>`. Verifica propietario UUID antes de eliminar exclusivamente esas bases. Cada suite comprueba conteos/evidencia compartidos sin cambios y elimina sus destinos temporales.

| Ejecución final | Aprobadas | Fallidas | Omitidas |
| --- | ---: | ---: | ---: |
| HU18 unitarias + rutas (2 suites Jest) | 93 | 0 | 0 |
| HU18 MySQL (incluye API funcional, Svix, rollback y backup) | 44 | 0 | 0 |
| Fase 0 MySQL | 25 | 0 | 0 |
| HU13 MySQL | 27 | 0 | 0 |
| HU14 MySQL | 74 | 0 | 0 |
| HU15 MySQL | 54 | 0 | 0 |
| HU16 MySQL | 30 | 0 | 0 |
| HU17 MySQL | 23 | 0 | 0 |
| Backend completo: Node 93 + Jest 659 (53 suites) | 752 | 0 | 0 |
| Funcionales existentes, runner aislado | 12 | 0 | 0 |
| Frontend completo (46 archivos) | 166 | 0 | 0 |

HU18 está incluido en el backend completo: las filas de cobertura se superponen; no se suman como pruebas distintas. El frontend HU18 aporta 14 casos y HU16 agrega un caso del comprobante posterior al refund.

Comandos de pruebas, desde backend, con infraestructura TEST activa:

```powershell
$env:RUN_PHASE0_MYSQL_TESTS='1'
$env:PHASE0_TEST_DATABASE='nexus_phase0_test_20261001_a9a8f83b'
$env:PHASE0_TEST_PORT='20378'
npm.cmd run test:hu18:mysql
npm.cmd run test:phase0:mysql
npm.cmd run test:hu13:mysql
npm.cmd run test:hu14:mysql
npm.cmd run test:hu15:mysql
npm.cmd run test:hu16:mysql
npm.cmd run test:hu17:mysql
npm.cmd run test:phase0:functional
npm.cmd test
```

Desde frontend: `npm.cmd test -- --run` y `npm.cmd run build`. Build correcto; permanece la advertencia preexistente por bundle mayor a 500 kB. `git diff --check` correcto. Las pruebas usan fixtures de credenciales y fetch mock; HU18 MySQL impide requests externos y permite únicamente su servidor HTTP 127.0.0.1. No se usan tarjetas ni dinero real.

## 12. Registro inicial anterior a la validación manual

Al cerrar la implementación inicial todavía no se había reiniciado el backend manual para HU18, aplicado 005 a la base compartida ni creado el nuevo pago exclusivo. La sesión HU13-HU17 anterior no constituía validación manual de este código. La validación posterior y su cierre se registran en la sección 15.

Cuando el usuario autorice la preparación manual, se deberá verificar/aplicar 005 solo en TEST, cargar esta versión y preparar una cuota/pago Sandbox nuevos exclusivos de HU18. Se preservan como evidencia permanente PAGO 395/TR 296/checkout 433/cuota 171 y TR 486/checkout 937/cuota 998.

El usuario hará el nuevo pago y luego, como ADMIN, consultará su transacción en `/admin/pagos/reembolsos`, registrará motivo, revisará el importe y confirmará UNA solicitud total. La auditoría posterior deberá demostrar PAGO original intacto, un solo refund aplicado, saldo reabierto correcto, fechas Guatemala, comprobante/PDF conservados y HU17 sin efectos financieros.

Debe observarse el contrato REAL del refund y su webhook: el ejemplo publicado carece de campos de ambiente. Si el evento real tampoco los aporta, la revisión conservadora es esperable; la confirmación podrá realizarse mediante respuesta POST suficiente o GET autenticado del refund conocido. La verificación de una fila refund no elimina automáticamente un inbox en REVISION: esa evidencia puede seguir bloqueando la cuota hasta su resolución segura. Un resultado sin ID seguro permanece bloqueado para resolución aprobada; no hay botón de desbloqueo ni reenvío automático.

No se implementa ahora recuperación administrativa de refunds externos desconocidos, refunds parciales, producción, void de refund, anulación del pago original ni HU19. Son límites expresos del alcance, no validaciones reales completadas.

## 13. Archivos creados y modificados

Las rutas siguientes son relativas a `proyecyo-1/`.

### Creados (15)

```text
docs/recurrente-hu18.md
backend/sql/migrations/005_recurrente_refunds.sql
backend/src/routes/adminRecurrenteRefundRoutes.js
backend/src/routes/__tests__/recurrenteRefund.hu18.routes.test.js
backend/src/services/recurrenteRefundClient.js
backend/src/services/recurrenteRefundContract.js
backend/src/services/recurrenteRefundGuard.js
backend/src/services/recurrenteRefundService.js
backend/src/services/__tests__/recurrenteRefund.hu18.test.js
backend/test/integration/hu18.mysql.test.js
backend/test/integration/support/recurrenteRefundFixtures.js
frontend/src/services/recurrenteRefundService.ts
frontend/src/services/recurrenteRefundService.test.ts
frontend/src/views/AdminRecurrenteRefundView.tsx
frontend/src/views/AdminRecurrenteRefundView.test.tsx
```

### Modificados (52)

```text
backend/package.json
backend/scripts/migrate-recurrente.js
backend/scripts/run-isolated-tests.js
backend/scripts/start-hu13-sandbox.js
backend/server.js
backend/src/__tests__/recurrenteRawBody.test.js
backend/src/app.js
backend/src/database/__tests__/recurrenteMigration.test.js
backend/src/database/recurrenteMigration.js
backend/src/services/__tests__/financialPeriods.test.js
backend/src/services/__tests__/recurrenteAttemptPayload.test.js
backend/src/services/__tests__/recurrenteWebhookPayload.test.js
backend/src/services/adminPaymentsService.js
backend/src/services/adminRemindersService.js
backend/src/services/adminSanctionsService.js
backend/src/services/financialBalance.js
backend/src/services/financialRulesService.js
backend/src/services/paymentReceiptService.js
backend/src/services/recurrenteCheckoutErrors.js
backend/src/services/recurrenteCheckoutService.js
backend/src/services/recurrenteCheckoutStatus.js
backend/src/services/recurrenteReadClient.js
backend/src/services/recurrenteReconciliationCompare.js
backend/src/services/recurrenteReconciliationService.js
backend/src/services/recurrenteWebhookPayload.js
backend/src/services/recurrenteWebhookService.js
backend/src/services/residentAccountService.js
backend/src/services/residentFinancialDetailService.js
backend/src/services/simulatedPaymentsService.js
backend/src/services/tenantAccountService.js
backend/test/detalleFinanciero.test.js
backend/test/integration/hu14.mysql.test.js
backend/test/integration/support/suiteIsolation.js
backend/test/residentAccount.test.js
backend/test/tenantAccount.test.js
frontend/src/components/admin/AdminLayout.tsx
frontend/src/components/payments/RecurrenteReceipts.tsx
frontend/src/routes/AppRouter.tsx
frontend/src/types/account.ts
frontend/src/types/financialBalance.ts
frontend/src/types/financialDetail.ts
frontend/src/types/paymentReceipt.ts
frontend/src/types/recurrenteReconciliation.ts
frontend/src/types/tenantAccount.ts
frontend/src/views/AdminMonthlyFinancialReportView.test.tsx
frontend/src/views/AdminMonthlyFinancialReportView.tsx
frontend/src/views/AdminRecurrenteReconciliationView.tsx
frontend/src/views/InquilinoAccountView.tsx
frontend/src/views/ResidenteAccountView.tsx
frontend/src/views/ResidenteFinancialDetailView.tsx
frontend/src/views/ResidentePaymentReceiptView.test.tsx
frontend/src/views/ResidentePaymentReceiptView.tsx
```

Los tests HU14/HU15 anteriores que consideraban `refund.create` un evento sin soporte se adaptaron al nuevo alcance. No se eliminó su garantía de cero PAGO ante payload inválido. Los DTO de balance existentes agregan bruto/devuelto/neto. `recurrenteRawBody.test.js` usa configuración vacía explícita para probar fallo cerrado sin depender de secretos locales.

## 14. Auditoría Git, secretos y evidencia protegida

Trabajo sin publicar sobre `main`, HEAD `2591cfec1b6b5905d08f947ad4a92f4ba9d4ac8c`. No se creó rama, commit, push, PR ni merge. Staging vacío. `.env` continúa ignorado y no se modificó ni se imprimió. Las respuestas, nuevo frontend y archivos de pruebas no contienen llaves reales.

Se preservaron `evidencias_sprint/`, `rt -uo` y el hunk preexistente de AdminLayout **Reporte financiero**. El hunk HU18 agrega únicamente **Reembolsos de pagos** y está separado.

`git diff --stat` para archivos ya rastreados: **52 archivos, 256 inserciones, 71 eliminaciones**. Incluye las 5 líneas preexistentes de AdminLayout y excluye los 15 archivos nuevos porque no se agregaron al staging.

La auditoría fuente es solo lectura y contrasta conteos y hashes completos de las ocho tablas financieras con el baseline. Los conteos esperados se mantienen: CUOTA 1209, RECARGO_APLICADO 1102, PAGO 599, PAGO_ORIGEN 599, CHECKOUT_RECURRENTE 1072, TRANSACCION_RECURRENTE 466, EVENTO_RECURRENTE 764 y REEMBOLSO_RECURRENTE 33. Los runners verifican además la evidencia protegida antes/después.

Cuota 171: PAGO 395 Q5 original, TR 296 CONFIRMADA/id_pago395, checkout 433 CONFIRMADO/paid, saldo Q0. Cuota 998: 0 PAGO, TR 486 FALLIDA/id_pagoNULL, checkout 937 PENDIENTE/unpaid, saldo Q5. No se solicita refund para estas operaciones.

No se modificó la base normal ni la base TEST compartida. No hubo llamadas reales a la API de Recurrente, pagos, checkouts, replays o reembolsos Sandbox durante la implementación. Solo hubo cambios HU18 de código, documentación y fixtures en bases temporales propias.

## 15. Cierre manual Sandbox y recuperación controlada — 2026-10-04

Este apartado actualiza el estado de validación; los conteos y resultados anteriores corresponden a la implementación inicial. El usuario efectuó el pago y un único reembolso total Sandbox. La corrección y recuperación aquí registradas no realizaron ninguna llamada nueva a Recurrente, ningún replay HTTP/Svix ni otra operación financiera.

La cuota TEST 1210 conserva capital Q5 y recargos Q0. PAGO 658 sigue siendo el registro histórico original Q5, fecha 2026-10-04, RECURRENTE/sandbox. TR 601 permanece REEMBOLSADA/id_pago658; checkout 1139 permanece CONFIRMADO/paid. Refund 78 sigue CONFIRMADO/succeeded, 500 centavos GTQ, con capital revertido 500 y recargo revertido 0. Su confirmación y aplicación originales por POST, 2026-10-04 14:12:14.338404, no cambiaron. Bruto Q5, devuelto Q5, neto Q0 y saldo pendiente Q5; vence 2026-10-11, sin mora artificial.

El evento real 1076, refund.create, había quedado REVISION/REFUND_ENVIRONMENT_UNPROVEN por live_mode false anidado. Tras las pruebas aisladas, el dry-run encontró la captura original, SHA-256 exacto, Sandbox explícito y asociaciones inequívocas refund78 -> TR601 -> PAGO658 -> cuota1210/checkout1139. Devolvió duplicate/alreadyApplied, con financialRowsModified=0.

Se ejecutó la recuperación privilegiada existente con --event=1076 --apply; devolvió duplicate. EVENTO 1076 pasó a PROCESADO, intentos 2, live_mode 0 y error NULL. Conservó svix-id, hash y recibido_en original 2026-10-04 14:12:17.973628. La revisión nueva 3 conservó por SQL -> SQL procesado_anterior EXACTO 2026-10-04 14:12:18.011275, error anterior REFUND_ENVIRONMENT_UNPROVEN y resultado PROCESADO. refund_bloqueante de cuota1210 quedó 0.

La comparación completa antes/después demuestra: CUOTA 1210 filas, RECARGO_APLICADO 1102, PAGO 600, PAGO_ORIGEN 600, CHECKOUT_RECURRENTE 1073, TRANSACCION_RECURRENTE 467, REEMBOLSO_RECURRENTE 34 e INTENTO_RECURRENTE 2, todos idénticos por contenido. EVENTO_RECURRENTE sigue en 769 filas: solo cambió el ciclo de procesamiento de 1076. REVISION pasó de 2 a 3, con los registros previos intactos. REPARACION_REVISION_RECURRENTE sigue en 1 fila idéntica. Intents A fallido y B confirmado/canónico permanecen intactos, al igual que los casos protegidos 171 y 998.

HU16 devolvió NXR-00000658, monto y fecha originales, devuelto Q5, neto Q0 y transacción REEMBOLSADA, sin generar PDF. El catálogo local HU17 expone bruto/devuelto/neto y refund78 correctamente asociado, con los eventos 1072–1076 PROCESADOS y ninguna revisión pendiente de esta operación. No se ejecutó conciliación externa.

Pruebas finales previas al apply: backend 799 aprobadas (93 Node + 706 Jest, 56 suites Jest), frontend 167/46 archivos, funcionales 12. MySQL: Fase0 25; HU13 27; HU14 74; HU15 54; HU16 30; HU17 23; HU18 64, repetida dos veces con 64/64 en ambas; correlación 33; precisión 17. Total MySQL 347 casos distintos y 411 ejecuciones contando la repetición. Cero fallidas/omitidas en las ejecuciones finales. Build OK, con advertencia previa de tamaño de bundle. git diff --check OK. La nueva prueba concurrente detectó inicialmente una inversión de bloqueos al asociar la FK del inbox; se corrigió antes de las dos ejecuciones verdes.

Las 11 subtareas quedan CUMPLIDAS dentro del alcance aprobado, incluido el tratamiento documentado de void fuera de esta versión. Las pruebas y su limpieza usaron únicamente bases temporales propias del runner; la única escritura autorizada sobre la base TEST compartida fue la recuperación del inbox1076 y su historial. .env permanece idéntico y no se expusieron secretos. Sin commit, push, PR, merge ni nuevas ramas; git diff --check fue únicamente la revisión de lectura solicitada. No se inició HU19.
