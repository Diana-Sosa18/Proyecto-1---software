# HU2 — Recordatorios automáticos de pago

## Objetivo

Permitir al administrador enviar recordatorios automáticos a los residentes cuyas cuotas están
próximas a vencer o ya vencieron, mediante notificaciones internas, con una configuración de
cuántos días de anticipación avisar y un historial de los recordatorios enviados. Pantalla:
`/admin/recordatorios`.

## Regla de negocio

Para cada `CUOTA` con saldo pendiente (`monto - pagos > 0`), unida a `CASA` → `RESIDENTE` →
`USUARIO` (propietario) y a `SERVICIO`, se determina el tipo de recordatorio comparando su
`fecha_limite` contra la fecha actual (zona horaria `America/Guatemala`):

- **PROXIMO_VENCIMIENTO**: la cuota vence hoy o dentro de los próximos `dias_antes` días.
- **VENCIDO**: la `fecha_limite` ya pasó y la cuota no registra pago completo.

Por cada cuota que aplica se crea una `NOTIFICACION` (tipo `RECORDATORIO_PAGO`) para el residente
y se registra el envío en `RECORDATORIO_PAGO`. La restricción única
`(id_cuota, tipo, fecha_envio)` evita enviar el mismo recordatorio dos veces el mismo día.

### Plantilla de notificación

El texto se arma en `buildReminderTemplate`:

- Próximo: *"Recordatorio de pago próximo — Su cuota de {servicio} por Q{monto} vence {hoy/mañana/en
  N días} ({fecha}). Realice su pago a tiempo…"*.
- Vencido: *"Pago vencido pendiente — Su cuota de {servicio} por Q{monto} venció el {fecha} (hace N
  días). Regularice su pago para evitar recargos."*.

## Configuración (SCRUM-406)

Se guarda en la tabla `CONFIGURACION` (clave/valor):

| Clave | Valor por defecto | Descripción |
|-------|-------------------|-------------|
| `recordatorios_activo` | `true` | Habilita o deshabilita el envío automático |
| `recordatorios_dias_antes` | `3` | Días de anticipación (0 a 60) para avisar antes del vencimiento |

## Endpoints

Todos requieren sesión de administrador (`x-user-role: admin`, `x-user-id: <id>`, middleware
`requireAdmin`).

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/admin/recordatorios/configuracion` | Devuelve `{ activo, dias_antes }` |
| PUT | `/admin/recordatorios/configuracion` | Guarda la configuración (valida `dias_antes` 0–60) |
| GET | `/admin/recordatorios/resumen` | Totales: total, próximos, vencidos, enviados hoy |
| POST | `/admin/recordatorios/generar` | Ejecuta el envío automático; devuelve `{ enviados, fecha_revision, activo }` |
| GET | `/admin/recordatorios` | Historial de recordatorios (filtros `search` y `type`) |

### Ejemplo de respuesta (historial)

```json
[
  {
    "id_recordatorio": 5,
    "casa_unidad": "A-101",
    "residente": "Residente Demo",
    "correo": "residente@test.com",
    "tipo": "VENCIDO",
    "titulo": "Pago vencido pendiente",
    "mensaje": "Su cuota de Agua potable por Q500.00 vencio el 2026-07-30 (hace 4 dias)...",
    "monto": 500,
    "fecha_limite": "2026-07-30",
    "dias_para_vencer": -4,
    "servicio": "Agua potable",
    "enviado_en": "2026-08-03 09:15"
  }
]
```

## Modelo de datos

Tabla nueva `RECORDATORIO_PAGO` (creada en `sql/init.sql` y de forma idempotente en
`ensureRemindersSchema` de `backend/src/database/mysql.js`, registrada en `server.js`):

- `id_recordatorio`, `id_casa`, `id_cuota`, `id_usuario`, `id_notificacion`
- `tipo` (`PROXIMO_VENCIMIENTO` | `VENCIDO`), `titulo`, `mensaje`, `monto`, `fecha_limite`,
  `dias_para_vencer`, `fecha_envio`, `enviado_en`
- Único `(id_cuota, tipo, fecha_envio)` para no duplicar envíos por día.

## Código relevante

- `backend/src/services/adminRemindersService.js`
- `backend/src/controllers/adminRemindersController.js`
- `backend/src/routes/adminRemindersRoutes.js`
- `frontend/src/services/remindersService.ts`
- `frontend/src/types/reminders.ts`
- `frontend/src/views/AdminRemindersView.tsx`

## Pruebas

```
cd proyecyo-1/backend
npm install
npm test
```

- **Unitarias** (`backend/test/recordatoriosPago.test.js`, `node:test`): validación de tipos y días
  de anticipación, armado de la plantilla (próximo/mañana/hoy/vencido) y mapeo de filas.
- **Funcionales** (`backend/test/recordatoriosPago.functional.test.js`): peticiones HTTP reales
  contra el backend levantado; se ejecutan con `RUN_FUNCTIONAL_TESTS=1` (`npm run test:functional`)
  y validan el middleware de administrador, el resumen/configuración/historial, el envío y la
  validación de `dias_antes`.
