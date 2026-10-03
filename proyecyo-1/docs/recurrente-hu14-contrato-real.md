# HU14: contrato observado en las entregas Sandbox 348/349

Corrección del 2 de octubre de 2026. Se conserva el alcance HU14; no se implementan HU15–HU19. No se modifica backend/.env, no se hacen llamadas a la API de Recurrente y no se crea otro checkout ni se paga nuevamente.

## Evidencia y causa raíz

La base TEST es nexus_phase0_test_20261001_a9a8f83b, MySQL 127.0.0.1:20378. Cuota 171, checkout local 433, externo ch_orahuujriakj0kgk, Q5 GTQ. Ambas entregas reales recibieron HTTP 200 después de verificar Svix, pero quedaron IGNORADO y no aplicaron PAGO:

- 348: payment_intent.succeeded, WEBHOOK_UNSUPPORTED_EVENT.
- 349: intent.succeeded, WEBHOOK_ENVIRONMENT_MISMATCH.

EVENTO_RECURRENTE almacena hashes y auditoría mínima, no el body completo. Se inspeccionaron en memoria las capturas locales disponibles en ngrok; el SHA-256 del body de cada captura coincide con el hash de su evento. No se copiaron bodies, firmas, clientes, datos de tarjeta ni secretos al repositorio. Los fixtures son sintéticos y reproducen exclusivamente los campos necesarios.

## Normalización

| Campo | payment_intent.succeeded (348) | intent.succeeded (349) |
|---|---|---|
| Tipo de evento | event_type raíz | event_type raíz |
| ID original del evento/operación | id raíz, distinto del intent | id raíz del intent |
| Intent canónico compartido | checkout.latest_intent.id | id raíz, que debe coincidir con checkout.latest_intent.id cuando esté presente |
| Tipo del intent anidado | PaymentIntent obligatorio | PaymentIntent cuando latest_intent esté presente |
| Pago físico compartido | payment.id / checkout.payment.id | payment.id / checkout.payment.id |
| Ambiente | live_mode raíz y checkout.live_mode | checkout.live_mode; raíz ausente en el body observado |
| Sandbox | sandbox_id raíz | sandbox_id raíz |
| Checkout | checkout.id | checkout.id |
| Monto/moneda | amount_in_cents / currency raíz | amount_in_cents / currency raíz |
| Éxito | tipo succeeded + checkout.status paid; sin failure_reason | type payment + status succeeded; checkout.status paid si se proporciona |
| Fecha contable | created_at raíz, con offset explícito | created_at raíz, con offset explícito |
| Referencia opcional | checkout.metadata.nexus_checkout_reference | checkout.metadata.nexus_checkout_reference |

No se elige una ubicación favorable cuando existen datos contradictorios: todo live_mode suministrado debe ser booleano y coincidir, el resultado debe ser false, y sandbox_id debe coincidir exactamente con la configuración backend. Un sandbox_id adicional en checkout también debe coincidir. La presencia de true, valores ambiguos o ausencia de evidencia impide cualquier aplicación financiera.

El total/moneda de checkout se contrastan con los de la raíz cuando estén presentes; sus payment.id deben concordar. El nombre de evento por sí solo no habilita un cobro. payment_intent.succeeded incompleto queda en REVISION, no se trata como evento desconocido ni se completa inventando datos.

La asociación local es la fuente de verdad: checkout externo persistido, residente/usuario/casa/cuota, ambiente, referencia opcional, monto autorizado y moneda deben coincidir. La metadata no crea ni sustituye asociaciones. created_at raíz se conserva y convierte a America/Guatemala; las fechas de recepción/procesamiento SQL siguen separadas. Para las entregas reales inspeccionadas la fecha contable esperada es 2026-10-02. No se usa la creación del checkout ni la recepción del retry como fecha del pago.

## Una sola aplicación financiera

Los dos cuerpos contienen el mismo checkout.latest_intent.id y el mismo payment.id, aunque sus IDs raíz y svix-id difieren. TRANSACCION_RECURRENTE.id_externo utiliza el intent canónico; id_pago_externo conserva el payment físico compartido. EVENTO_RECURRENTE.id_operacion_externa conserva cada ID raíz original.

Se mantienen las restricciones UNIQUE existentes de ambiente/svix-id, ambiente/id_externo y ambiente/id_pago_externo. No se necesita otra migración. El identificador de idempotencia se deriva del intent canónico, sin incluir el tipo del evento. Dos entregas solapadas llegan a la misma transacción; el segundo evento compatible finaliza PROCESADO con respuesta duplicate y no crea PAGO.

El bloqueo de CUOTA antes de CHECKOUT_RECURRENTE y la transacción SQL atómica existentes serializan aplicaciones concurrentes. PAGO, PAGO_ORIGEN, transacción confirmada, checkout CONFIRMADO/paid e inbox PROCESADO se confirman juntos o se revierten juntos. Se mantiene la lógica común: todos los abonos confirmados, recargos primero, capital después, sin saldos negativos ni sobrepagos silenciosos.

## Recuperación controlada de IGNORADO anteriores

No se borran eventos, no se reinicia su estado por SQL manual y no se ejecuta un reprocesamiento automático al arrancar. Una nueva entrega debe pasar nuevamente la firma oficial Svix sobre el body original y su ventana temporal.

Un IGNORADO puede reevaluarse exclusivamente si:

1. ambiente/svix-id ubican el registro original y el hash del body es idéntico;
2. el tipo almacenado coincide con el tipo recibido y es uno de los dos succeeded admitidos;
3. el motivo anterior es WEBHOOK_UNSUPPORTED_EVENT o WEBHOOK_ENVIRONMENT_MISMATCH;
4. la normalización actual produce PAYMENT y pasa los controles estrictos de identidad, ambiente, monto, moneda, fecha y éxito.

Después se verifican también las asociaciones y restricciones financieras locales. Se conservan id_evento, svix-id, hash, recepción original e ID original de la operación. Durante el procesamiento autorizado se incrementa intentos, se actualizan los indicadores de ambiente normalizados y se sustituye el estado/error anterior por el resultado actual. Si la operación SQL falla, se conserva una recepción reintentable FALLIDO sin efectos financieros; una confirmación concurrente nunca se sobrescribe.

PROCESADO y REVISION permanecen terminales. Un IGNORADO cuyo body sigue siendo inseguro o no soportado permanece terminal. Un body diferente con el mismo svix-id responde 409. Esta recuperación no depende de que transcurra tiempo ni permite doble aplicación del mismo pago.

## Pruebas y entorno

Los casos A–N solicitados se cubren con firmas y IDs TEST: cada contrato, ambos órdenes, replays repetidos, concurrencia, ambiente ajeno/producción/contradicciones, firma inválida antes de persistir, monto/moneda incompatibles, checkout desconocido, cuota pagada, rollback y recuperación de ambos IGNORADO antiguos. Las pruebas no utilizan la cuota 171 ni los eventos reales 348/349; crean sus propias obligaciones TEST. Los logs de ejecución se guardan fuera del repositorio.

## Retry real posterior, a cargo del usuario

El backend se prepara en http://127.0.0.1:3100 mediante start:hu14:sandbox. Se conserva el túnel gestionado por el usuario y el endpoint ya registrado: https://latrine-gauze-probing.ngrok-free.dev/webhooks/recurrente. No se inicia/administra ngrok ni se registra otro webhook.

En el Sandbox correcto, utilizar **Ver entregas y reintentar** sobre el mensaje existente **payment_intent.succeeded** del pago de Q5, asociado al checkout externo ch_orahuujriakj0kgk. Es el evento local 348, svix-id msg_3K9uuGGORbmbvxMLgERwHpzVeF5. Reintentar esa entrega no crea un checkout ni realiza otro pago. Después puede reintentarse intent.succeeded, evento 349, svix-id msg_3K9uuISBqAxhDyN3IDQILsa4diR, para demostrar la convergencia como duplicate.

Usar una nueva entrega del proveedor conserva la verificación temporal Svix; copiar la captura antigua de ngrok no constituye esta prueba. El agente no reenvía ninguno de los mensajes. [Replay de mensajes existentes en el portal Svix](https://docs.svix.com/receiving/using-app-portal/replaying-messages).

Resultado esperado después del primer retry válido: exactamente una TRANSACCION_RECURRENTE CONFIRMADA, exactamente un PAGO de Q5.00 fechado 2026-10-02 y origen RECURRENTE/sandbox, checkout 433 CONFIRMADO/paid, evento 348 PROCESADO y saldo real de cuota 171 Q0.00. El evento 349 permanece IGNORADO hasta recibir su propio retry; entonces debe finalizar PROCESADO/duplicate sin otro PAGO. La vista de retorno por sí sola sigue sin confirmar el pago.

## Validación completada antes del retry real

| Ejecución | Aprobadas | Fallidas | Omitidas |
|---|---:|---:|---:|
| Backend completo: node:test + Jest | 435 (93 + 342) | 0 | 0 |
| MySQL Fase 0 | 25 | 0 | 0 |
| MySQL HU13 | 27 | 0 | 0 |
| MySQL HU14 | 74 | 0 | 0 |
| Funcionales existentes con servidor TEST efímero | 12 | 0 | 0 |
| Frontend: 38 archivos | 106 | 0 | 0 |

Las cuatro pruebas HTTP funcionales HU14 están incluidas dentro de las 74 de MySQL HU14, no son un conteo adicional. El frontend no requirió cambios. Se conservaron los archivos y modificaciones preexistentes; esta corrección modifica siete archivos y agrega este documento.

El backend corregido fue reiniciado exclusivamente en 127.0.0.1:3100 y GET /health respondió 200. Se evaluó en memoria la normalización de ambas capturas auténticas, con hashes verificados, sin llamar al servicio de aplicación financiera ni enviar peticiones al webhook: las dos producen PAYMENT, intent canónico in_y4hil51d, pago compartido pa_xzdhbyna y fecha contable 2026-10-02.

Antes del retry del usuario se verificó exclusivamente por SELECT que la cuota 171 conserva saldo Q5.00, cero PAGO y cero transacciones, el checkout 433 sigue PENDIENTE/unpaid por Q5 GTQ/sandbox, y los eventos 348/349 conservan su estado IGNORADO, sus errores anteriores, intentos=1 y timestamps originales. No se modificaron manualmente esos registros ni la base normal. No se administró el túnel, no se modificó .env ni se realizó un retry externo. El backend queda activo para la entrega del proveedor.
