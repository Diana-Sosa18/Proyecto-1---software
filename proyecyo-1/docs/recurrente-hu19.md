# HU19 — Notificaciones automáticas de pagos y vencimientos

Base: `3fe515d123db6c33c2a574d2d4903263540736ec` (HU33). Rama:
`feature/sprint9-hu19-notificaciones-pagos`. Canal exclusivamente interno;
sin correo, SMS, WhatsApp, push externo, nuevas llamadas a Recurrente ni broker.

## Arquitectura y activación

La migración aditiva `backend/sql/migrations/008_financial_notifications.sql`
crea `ENTREGA_NOTIFICACION_FINANCIERA` y `CICLO_NOTIFICACION_CUOTA` mediante
`CREATE TABLE IF NOT EXISTS`. No altera 001–007 ni modifica filas históricas.
Añade de forma reaplicable una clave NOTIFICACION(id_notificacion,id_usuario),
para que la FK del outbox impida enlazar un aviso perteneciente a otro usuario.
El runner de migraciones y el arranque existentes incluyen 008 después de 007.
El CLI de notificaciones exige un esquema ya migrado: no migra, no crea fixtures,
no inicia el servidor y no instancia clientes de la pasarela.

Los productores HU14/HU15/HU18 agregan una entrega pendiente dentro de la misma
transacción que aplica el resultado autoritativo. Un fallo del outbox revierte
esa aplicación. El consumidor transforma la entrega en `NOTIFICACION` y marca
la entrega en la misma transacción. Una caída antes del commit deja ambos sin
aplicar; una caída después del commit conserva una única entrega.

No se recorren pagos, intentos o reembolsos históricos para generar avisos.
Un evento ya procesado sigue devolviendo `duplicate` sin insertar una entrega
retroactiva. El job sí atiende obligaciones actualmente pendientes con la política
de vencimientos. Los avisos antiguos permanecen con su contenido y lectura.

## Esquema y estados

Outbox: PK `id_entrega` BIGINT UNSIGNED, `dedup_key` SHA-256 UNIQUE NOT NULL,
usuario, cuota nullable, pago nullable, referencia canónica del intento,
reembolso nullable, tipo, ciclo, ventana, fecha objetivo, vencimiento capturado,
fecha de entrega Guatemala, importe/saldo/recargo en centavos enteros, GTQ,
ambiente, título y mensaje mínimos, acción permitida, estado, intentos,
código de error cerrado, timestamps DATETIME(6), próxima revisión y
`id_notificacion` nullable UNIQUE. Índices por pendientes, cuota/ciclo y usuario.
FK a USUARIO, CUOTA, PAGO/cuota, REEMBOLSO_RECURRENTE y NOTIFICACION/usuario.
CHECK limita estados, tipos, acciones, moneda, importes y asociaciones requeridas.

Estados:

| Estado | Significado |
|---|---|
| PENDIENTE | Persistida; todavía no publicada. Un bloqueo de deuda conserva este estado. |
| ENTREGADA | NOTIFICACION y asociación comprometidas juntas; terminal e inmutable. |
| OMITIDA | Destinatario sin autorización, deuda resuelta, ciclo/ventana anterior o fuente inválida; terminal. |
| ERROR | Fallo recuperable de entrega; solo código `ENTREGA_REINTENTABLE`, sin SQL ni causa privada. |

Los errores y bloqueos se revisan a partir de cinco minutos después. Ese plazo
solo controla el job: **jamás libera una operación financiera incierta**.
La tabla de ciclos conserva el número actual por cuota aunque no haya un
destinatario disponible; tiene FK a CUOTA y DATETIME(6).

## Tipos y deduplicación de negocio

| Tipo | Identidad antes del hash | Contenido/acción |
|---|---|---|
| PAGO_CONFIRMADO | PAGO + usuario | Importe, fecha contable oficial y referencia HU16; COMPROBANTE_PAGO. |
| PAGO_NO_COMPLETADO | ambiente + intento canónico + FALLIDA + usuario | No hubo abono por ese intento; ESTADO_CUENTA. |
| PAGO_CANCELADO | ambiente + intento canónico + CANCELADA + usuario | Cancelación del intento, sin afirmar cierre del checkout; ESTADO_CUENTA. |
| REEMBOLSO_CONFIRMADO | reembolso local + usuario original | Importe, pago original y saldo tras aplicación; ESTADO_CUENTA. |
| CUOTA_PROXIMA | cuota + usuario + ciclo + tipo + ventana | Saldo vigente y vencimiento; ESTADO_CUENTA. |
| CUOTA_HOY | cuota + usuario + ciclo + tipo + vencimiento | Aviso del día exacto; ESTADO_CUENTA. |
| CUOTA_VENCIDA | cuota + usuario + ciclo + tipo + INICIAL/SEMANA:n | Aviso inicial y seguimiento cada siete días; ESTADO_CUENTA. |

No se usa svix-id como dedup de notificaciones. Aliases y nuevas entregas del
mismo intento tienen la misma identidad de negocio. UNIQUE en MySQL es la
protección definitiva; `INSERT IGNORE` no se utiliza. Solo se acepta un
ER_DUP_ENTRY cuando se puede volver a localizar la misma dedup_key.

## Vencimientos y calendario

Se conserva `recordatorios_activo` y `recordatorios_dias_antes` (default 3;
0–60). Una próxima por ventana configurada, una hoy, una vencida inicial y
posteriores cuando hayan pasado siete días desde la última entrega efectiva a
ese usuario/ciclo. Cambiar anticipación modifica elegibilidad; no duplica una
próxima ya enviada para el mismo vencimiento y ciclo.

Una ejecución omitida entrega pendientes y evalúa el próximo seguimiento elegible;
no envía en ráfaga todas las semanas omitidas. La fecha efectiva de entrega
ancla los siguientes siete días, incluso si hubo errores o bloqueos antes de
publicar el aviso. Si ya pasó la etapa de hoy,
evalúa deuda vencida; no inventa una entrega histórica de hoy. Un outbox antiguo
se omite cuando ya no corresponde a la ventana/ciclo vigente.

`guatemalaDate()` usa explícitamente America/Guatemala. A las 00:00 UTC todavía
son las 18:00 del día anterior en Guatemala. La diferencia de dos fechas y el
avance de siete días usan UTC solo como aritmética de fechas de calendario ya
resueltas, nunca para decidir cuál es hoy. `fecha_entrega` registra por separado
el día efectivo del job en Guatemala; el historial conserva el vencimiento y
el importe capturados al entregar, aunque luego cambie el estado de la cuota.

## Finanzas y bloqueos

Se reutilizan QUOTA_BALANCES_SQL (incluye REFUND_TOTALS_SQL), calculateBalance
y toCents de `financialBalance.js`. Todos los PAGO confirmados cuentan, sin
filtros temporales, menos refunds CONFIRMADO con aplicado_en y origen válido.
La aplicación canónica conserva recargos primero y capital después. No existe
otra fórmula de saldo ni se consulta CUOTA.estado.

Saldo cero, sobrepago o inconsistencia de refunds impiden avisos de deuda.
El consumidor vuelve a calcular el saldo después de bloquear la cuota: un
pago aplicado durante la espera elimina el aviso pendiente antiguo. Los
recargos son de solo lectura; HU19 no llama a aplicar recargos. El mensaje
informa el saldo real y los recargos que siguen pendientes, sin prometer
"evitar recargos" cuando ya existen.

Se reutilizan BLOCKING_CHECKOUT_CONDITION, refundBlockingSql y successReviewSql.
Checkouts activos/inciertos, payment_in_progress, éxitos en revisión y refunds
reservados/inciertos/en revisión o confirmados sin aplicación suprimen los
recordatorios. Un fallo o cancelación de intento no libera su checkout.
Provider outcome unknown de un refund mantiene la reserva de HU18; no genera
REEMBOLSO_CONFIRMADO. No se emiten avisos definitivos por timeout, navegador,
retorno, evidencia no correlacionada o revisión. Una entrega confirmada previa
no se convierte en incierta porque otra operación posterior esté pendiente.

## Atomicidad y orden de bloqueos

HU14 y HU15 mantienen su inbox → cuota → checkout → transacción/historial.
HU18 mantiene cuota → checkout → transacción → refunds. Las inserciones HU19
y el ciclo ocurren al final de esos flujos, antes de su commit; no se cambian
importes, fecha_pago, allocations, guards, estados del proveedor o evidencias.

Generador: candidatos sin lock → READ COMMITTED → CUOTA FOR UPDATE → saldo
canónico → bloqueos → destinatarios actuales → ciclo/ventana → outbox → commit.
Consumidor: localizador sin lock → READ COMMITTED → CUOTA FOR UPDATE → entrega
FOR UPDATE → revalidación → NOTIFICACION + entrega → commit. Nunca bloquea el
outbox antes que la cuota. No mantiene una transacción abierta durante HTTP.
Dos procesos pueden elegir el mismo pendiente: el segundo ve ENTREGADA después
de esperar y no inserta otro aviso. La protección SQL funciona entre réplicas.

## Integración HU14, HU15 y HU18

HU14 llama enqueuePayment solo después de crear PAGO/origen, confirmar la
transacción y el checkout. Usa fecha contable oficial convertida a Guatemala;
no genera otro comprobante, conserva HU16.

HU15 llama enqueueAttempt después de persistir el resultado e INTENTO_RECURRENTE.
La razón enviada por el proveedor no se copia en el aviso: se usa texto cerrado
y seguro. El intento sin identidad canónica queda auditado según HU15, pero no
se inventa una identidad para vincular el alias ni un aviso definitivo. Consultar
el estado de cuenta no ejecuta retry; el usuario sigue usando el flujo HU15.

HU18 llama enqueueRefund solo en la primera aplicación autoritativa, tanto en
respuesta verificada como en webhook. Si el saldo pasa 0 → positivo incrementa
el ciclo bajo el mismo lock y explica la reapertura en el MISMO aviso de refund.
Un refund parcial con deuda todavía positiva conserva el ciclo. Replays no
avanzan el ciclo ni generan otra entrega. No se borra PAGO ni se modifica su
comprobante, fecha, lectura histórica o vencimiento original.

## Destinatarios y seguridad

Deuda: propietarios residentes activos según el filtro real de su estado de
cuenta; alquiler/renta excluida de esa vista no se notifica al propietario.
Inquilinos activos y autorizados reciben obligaciones de la unidad que su
estado de cuenta selecciona actualmente, usando su mismo LIMIT 1 y relaciones.
No se amplían roles ni unidades accesibles. Para una operación el destinatario
es id_usuario persistido; en refund es el pagador original, no el ADMIN solicitante.

Antes de entregar se verifican relación actual, usuario activo, rol y fuente
aplicada del aviso. Revocación antes de entrega produce OMITIDA. Un aviso ya
entregado permanece como historial aunque después cambie la relación.
Las rutas conservan req.authUser.id, guards y 404 para un aviso ajeno.
El endpoint ADMIN de generación conserva requireAdmin; no hay endpoint público
para ejecutar el job.

No se almacenan ni se muestran headers, firmas Svix, payloads completos,
secretos, PAN, CVV, tokens o contraseñas. Acciones solo ESTADO_CUENTA y
COMPROBANTE_PAGO, resueltas en frontend a rutas internas del rol con id_pago
entero positivo. No se acepta una URL arbitraria ni se redirige a proveedores.

## Scheduler, CLI y futuro Railway

El scheduler local existente ejecuta recordatorios financieros y consumo cada
cinco minutos, y conserva los recordatorios de reserva. El booleano local evita
solapamientos innecesarios, pero la dedup y los locks de MySQL son definitivos.
Configurar recordatorios_activo=false desactiva deuda, no las entregas de
resultados financieros autoritativos ya pendientes.

CLI desde backend, sobre una base seleccionada y migrada por el operador:

```text
npm.cmd run notifications:run
```

Procesa lotes de 100, hasta 10 lotes por ejecución. El siguiente cron continúa
el backlog. Cierra el pool en finally y termina; exit 1 en error recuperable,
manteniendo los pendientes. Solo imprime contadores y fecha, sin configuración.

Para futuro Railway: cron independiente `*/5 * * * *`, command
`npm run notifications:run`, con variables del backend y base ya migrada. El
cron puede estar en UTC; los vencimientos siguen en Guatemala. No se realizó
despliegue ni configuración de Railway.

## Frontend y backup/restore

Se conservan Dashboard, Centro de avisos, layouts y navegación HU33. Se agregan
etiquetas y acciones internas a la vista existente. Sidebar, Dashboard y Centro
recargan al marcar, recuperar foco/visibilidad y cada 60 segundos mientras la
pestaña está visible. Las respuestas antiguas no reemplazan cargas más nuevas.
El total siempre usa GET /notificaciones/no-leidas; listado LIMIT 20 es solo
vista previa. Marcar todas devuelve conteo vigente y recarga, sin inventar cero
cuando llega otro aviso durante la operación.

BACKUP_TABLES y RESTORABLE_TABLES incorporan NOTIFICACION, RECORDATORIO_PAGO,
RECORDATORIO_RESERVA y ambas tablas HU19, sin quitar las anteriores. El backup
usa una snapshot consistente y exige estas tablas. La restauración conserva
UNIQUE, estados, asociaciones, lectura, ciclos y microsegundos; verifica FKs
antes de commit incluso cuando MySQL necesita FOREIGN_KEY_CHECKS=0 durante la
carga. Todas las pruebas de restauración utilizan destinos desechables.

## Verificación reproducible, exclusivamente aislada

El runner exige RUN_PHASE0_MYSQL_TESTS=1, PHASE0_TEST_DATABASE con patrón TEST y
puerto aislado. Lee evidencia protegida de la base TEST compartida, crea
`..._run_<token>`, prepara esquema y fixtures sintéticos, comprueba evidencia y
conteos compartidos, verifica propiedad y elimina únicamente sus destinos.
No se ejecutan suites directamente sobre la base compartida ni sobre la normal.

Comandos disponibles desde backend:

```text
npm.cmd run test:hu19:mysql
npm.cmd run test:isolated:backend
npm.cmd run test:phase0:mysql
npm.cmd run test:hu13:mysql
npm.cmd run test:hu14:mysql
npm.cmd run test:hu15:mysql
npm.cmd run test:hu16:mysql
npm.cmd run test:hu17:mysql
npm.cmd run test:hu18:mysql
npm.cmd run test:correlation:mysql
node scripts/run-isolated-tests.js precision
npm.cmd run test:phase0:functional
```

Frontend: `npm.cmd test -- --run --maxWorkers=1 --pool=threads --testTimeout=15000`
y `npm.cmd run build`.
No se instalan dependencias para un typecheck. Tests de pasarela usan mocks y
firmas sintéticas; una guarda impide fetch externo en HU19.

Cobertura HU19: las cuatro etapas, frecuencia semanal y ausencia de repetición
diaria; saldo cero, abonos fuera del período y recargos primero; sobrepago;
confirmación, fallo, cancelación y aliases; bloqueo incierto/review/progress;
refund aplicado, reapertura y ciclos; preservación de lectura e historial;
1/10/100 ejecuciones; generadores/consumidores concurrentes; carreras con pago
y refund; rollback de los tres productores y consumidor; destinatario/unidad
incorrectos, inquilino revocado y renta; Guatemala y medianoche UTC; conteo >20,
marcado individual/todas y nuevas llegadas; migración dos veces, FK/UNIQUE/
CHECK/DATETIME(6); backup/restore; reinicio y error recuperable; cero proveedor
real y cero aplicación paralela de recargos. Se ejecutan las regresiones
financieras y HU33 completas. La validación manual controlada se documenta
más abajo; no se inventa ni declara evidencia Sandbox nueva.

## Resultado de la validación automatizada (2026-10-04)

Últimas ejecuciones completas, sin sumar repeticiones previas:

| Suite | Aprobadas | Fallidas | Omitidas |
|---|---:|---:|---:|
| Backend completo: Node + Jest | 93 + 722 = 815 | 0 | 0 |
| Frontend completo, 61 archivos | 334 | 0 | 0 |
| MySQL: Phase 0, HU13–HU18, correlación, precisión y HU19 | 398 | 0 | 0 |
| Funcionales aisladas | 12 | 0 | 0 |

MySQL: 25 / 27 / 74 / 54 / 30 / 23 / 64 / 33 / 17 / 51 respectivamente.
HU19 añade 16 pruebas Jest, 51 MySQL y 18 frontend, además de adaptar las
pruebas existentes de destinatarios y actualización del contador.
El CLI se ejecutó realmente en la base desechable; terminó y cerró su pool.
Todas las bases de estas ejecuciones fueron eliminadas por su runner después
de validar propiedad y evidencia compartida. En esa ejecución automatizada
previa no se aplicó 008 a una base persistente; la aplicación posterior a TEST
se documenta en la validación manual controlada.

Build aprobado. Se conserva el warning previo de chunk mayor a 500 kB
(bundle 1.242,43 kB). Las ejecuciones frontend iniciales tuvieron timeouts de
5 segundos; se corrigió un mock de prueba y la ejecución final con un worker
de threads y timeout 15 segundos pasó completa. Se observaron solo 196 MB de
RAM libre; no se cerraron servicios ajenos ni se cambió configuración del sistema.
git diff --check aprobado. No se instaló ninguna dependencia para typecheck.

Límites operativos existentes: listado de avisos de 20, historial ADMIN de 100,
restauración de archivos SQL de hasta 2 MB. El límite del consumidor es 1.000
entregas por ejecución, recuperables en la siguiente; no se cambian límites de
upload o arquitectura de restauración fuera de la cobertura HU19.

## Validación manual controlada

Se aplicó 008 exclusivamente a la base TEST aislada autorizada, sin acceder
a la base normal ni hacer llamadas nuevas a Recurrente. Después de migrar,
ENTREGA_NOTIFICACION_FINANCIERA y CICLO_NOTIFICACION_CUOTA tenían cero filas;
NOTIFICACION y RECORDATORIO_PAGO conservaban 3.710 filas y RECORDATORIO_RESERVA
tenía cero. La migración no creó avisos retroactivos.

El backend se inició directamente mediante createApp(), sin migraciones,
seeds o schedulers. No se ejecutaron el CLI general, generateDeadlines(),
el consumidor general ni productores financieros sobre TEST compartida.
Los tres fixtures explícitos [HU19 TEST] se crearon mediante enqueue() y
se entregaron individualmente con deliver(id). Usaron usuario residente TEST,
cuota 1210, importe 500 centavos GTQ, sandbox, fecha objetivo 2026-10-04
y ciclo 0, sin crear filas de ciclo ni cambiar la evidencia financiera.

| Tipo | Evidencia local existente | Entrega | Notificación | Acción local |
|---|---|---:|---:|---|
| PAGO_CONFIRMADO | PAGO 658, transacción 601 | 1 | 3711 | /residente/pagos/658/comprobante |
| PAGO_NO_COMPLETADO | INTENTO 1, FALLIDA | 2 | 3712 | /residente/estado-cuenta |
| REEMBOLSO_CONFIRMADO | PAGO 658, refund 78 | 3 | 3713 | /residente/estado-cuenta |

Se verificaron PENDIENTE antes de entregar y ENTREGADA después, con una sola
NOTIFICACION sin leer por entrega. Reencolar las tres identidades exactas del
fixture devolvió created=false y los mismos IDs; no añadió ni alteró filas.
Las claves exclusivas del fixture no coinciden con las identidades de entregas
reales futuras. El comprobante conserva el pago histórico NXR-00000658 y
su reembolso posterior; la cuota HU18 Sandbox Refund Q5 TEST conserva saldo
reabierto Q5.00. El aviso de fallo corresponde a un intento anterior sin abono
por ese intento, aunque otro intento posterior sí tuvo éxito.

El residente tenía cero no leídas antes de crear los fixtures, tres después
y cero al finalizar la revisión. La secuencia 3 → 2 → 0 se reconstruye de la
evidencia SQL: primero se leyó 3711 (2026-10-04 22:56:41); después se leyeron
3713 (22:57:19) y 3712 (22:57:20). Hubo un estado intermedio de una no leída.
Antes de limpiar, las tres entregas seguían ENTREGADA y las tres notificaciones
tenían leido=TRUE y leido_en registrado. El inquilino conservó sus 1.855 avisos
históricos sin leer. La confirmación visual de badge/KPI y apertura de enlaces
debe distinguirse de esta evidencia SQL; no se deduce de los timestamps.

Se investigaron los signos «?» que reemplazaron acentos en los mensajes del
fixture. Ya estaban presentes en el script temporal antes de enqueue():
PowerShell envió ese script a Node por stdin con OutputEncoding=us-ascii.
La conexión y las columnas MySQL son utf8mb4; una consulta SELECT con parámetros
Unicode preservó exactamente los acentos y sus bytes UTF-8. Los textos del
productor HU19 en el repositorio conservan sus acentos y la API devuelve el
mensaje persistido sin recodificarlo. El fallo fue de preparación del fixture,
no un bug de encoding de HU19. No se cambió código ni se repararon artificialmente
los mensajes almacenados.
Para futuras preparaciones locales, escribir el script directamente en UTF-8
o usar escapes Unicode; no pasarlo con acentos por un pipe nativo en ASCII.

La limpieza autorizada eliminó únicamente las entregas 1–3 y las notificaciones
3711–3713 identificadas por el manifiesto, comprobando usuario, cuota, tipos,
claves, asociaciones y estado de lectura. Se borró primero el outbox y después
las notificaciones, en una sola transacción. No se reiniciaron contadores ni
se restauraron sesiones artificialmente. Los snapshots y el manifiesto de
auditoría se conservan fuera del repositorio.

| Tabla / contador | Antes de limpiar | Después |
|---|---:|---:|
| NOTIFICACION | 3713 | 3710 |
| ENTREGA_NOTIFICACION_FINANCIERA | 3 | 0 |
| CICLO_NOTIFICACION_CUOTA | 0 | 0 |
| RECORDATORIO_PAGO | 3710 | 3710 |
| RECORDATORIO_RESERVA | 0 | 0 |
| No leídas residente | 0 | 0 |
| No leídas inquilino | 1855 | 1855 |

Los hashes de todas las filas, importes, asociaciones y timestamps de las once
tablas financieras coincidieron con el snapshot anterior a la preparación.
Las notificaciones originales y ambos historiales de recordatorios también
coincidieron exactamente. Se conservaron saldo 171=Q0.00, saldo 998=Q5.00 y
saldo 1210=Q5.00; PAGO 658, refund 78 CONFIRMADO/aplicado y transacción 601
REEMBOLSADA permanecieron intactos. Cero nuevas llamadas a Recurrente y cero
escrituras financieras. La actividad normal de SESION_ACTIVA del usuario
estuvo expresamente autorizada y se dejó intacta.

Después de limpiar y actualizar la documentación se repitió la regresión:

| Suite de cierre | Aprobadas | Fallidas | Omitidas |
|---|---:|---:|---:|
| Backend completo: 93 Node + 722 Jest | 815 | 0 | 0 |
| Frontend completo, 61 archivos | 334 | 0 | 0 |
| HU19 MySQL: servicios, SQL, concurrencia y rutas | 51 | 0 | 0 |
| Funcionales existentes, servidor efímero aislado | 12 | 0 | 0 |

Todas las suites que escriben utilizaron destinos desechables del runner,
con proveedor simulado/bloqueado; ninguna escribió en TEST compartida.
Los runners eliminaron cuatro destinos propios (incluido el de restore)
y verificaron conteos y evidencia compartida sin cambios. La cobertura
funcional específica HU19 incluye consultas/marcado de avisos, aislamiento
de usuario, permisos ADMIN, entrega, deduplicación y recuperación en su suite
MySQL, además de las pruebas de interfaz del frontend completo.
El build aprobó; se conserva el warning previo de bundle mayor a 500 kB.
No se instaló software ni se cambiaron configuraciones del sistema.
