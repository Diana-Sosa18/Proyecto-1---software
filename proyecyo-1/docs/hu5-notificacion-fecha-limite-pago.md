# HU5 — Notificación de fecha límite de pago

## Objetivo

Avisar automáticamente al residente cuando una cuota está próxima a vencer o se encuentra
vencida, mostrar la alerta dentro del portal y conservar un historial administrativo de cada
notificación enviada.

## Funcionalidad implementada

- **SCRUM-431:** generación automática de notificaciones al iniciar el backend y cada hora.
- **SCRUM-432:** configuración administrativa del estado y de los días de anticipación (0 a 60).
- **SCRUM-433:** alertas no leídas visibles en el inicio del residente.
- **SCRUM-434:** historial persistente en `RECORDATORIO_PAGO`, vinculado con `NOTIFICACION`.
- **SCRUM-435:** pantalla `/admin/recordatorios` integrada con los endpoints del backend.
- **SCRUM-436:** pruebas unitarias de validación, plantillas y transformación de registros.
- **SCRUM-437:** pruebas funcionales HTTP para autorización, configuración, historial y envío.
- **SCRUM-438:** esta documentación técnica y funcional.

## Reglas de negocio

Solo se procesan cuotas con saldo pendiente. Una cuota con fecha límite entre hoy y el número de
días configurado produce una notificación `PROXIMO_VENCIMIENTO`; una fecha anterior produce una
notificación `VENCIDO`. La fecha se calcula en la zona horaria `America/Guatemala`.

La combinación `(id_cuota, tipo, fecha_envio)` es única. Por eso el programador puede ejecutarse
varias veces al día sin enviar duplicados, incluso si dos ejecuciones coinciden.

## Endpoints administrativos

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/admin/recordatorios/configuracion` | Consultar configuración |
| `PUT` | `/admin/recordatorios/configuracion` | Activar y definir anticipación |
| `GET` | `/admin/recordatorios/resumen` | Consultar totales |
| `POST` | `/admin/recordatorios/generar` | Ejecutar manualmente |
| `GET` | `/admin/recordatorios` | Consultar historial y filtros |

Los endpoints requieren rol administrador. El residente usa los endpoints protegidos de
`/notificaciones` para consultar alertas y marcarlas como leídas.

## Verificación

```text
cd backend
npm test

cd ../frontend
npm run build
```
