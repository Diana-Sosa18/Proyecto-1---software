# HU2 — Visualizar listado de residentes morosos

## Objetivo

Permitir al administrador ver, en `/admin/pagos`, el listado real de residentes con cuotas
pendientes: cuanto deben, cual es su proxima fecha limite y si estan al dia, pendientes o en
mora, con filtros de busqueda.

## Regla de negocio

Para cada `CASA` se suman todas sus `CUOTA` y se restan los `PAGO` asociados a cada cuota:

- `monto_pendiente` = suma de `(cuota.monto - pagado)` solo cuando ese saldo es mayor a 0.
- `fecha_limite` = la fecha limite mas proxima entre las cuotas con saldo pendiente.
- `estado`:
  - `PAGADO` si `monto_pendiente <= 0`.
  - `MOROSO` si tiene saldo pendiente y al menos una cuota vencida (`fecha_limite < CURDATE()`).
  - `PENDIENTE` si tiene saldo pendiente pero ninguna cuota vencida todavia.

## Endpoint

`GET /admin/pagos`

Requiere headers de sesion de administrador (`x-user-role: admin`, `x-user-id: <id>`), igual que
el resto de endpoints `/admin/*` (middleware `requireAdmin`).

### Query params (todos opcionales)

| Param    | Valores                          | Descripcion                                   |
|----------|-----------------------------------|------------------------------------------------|
| `search` | texto libre                       | Filtra por nombre del residente o unidad       |
| `estado` | `MOROSO` \| `PENDIENTE` \| `PAGADO` \| `TODOS` | Filtra por estado de cuenta        |
| `date`   | `YYYY-MM-DD`                      | Filtra por fecha limite exacta                |

### Ejemplo de respuesta

```json
[
  {
    "id_casa": 3,
    "unidad": "A-101",
    "propietario_nombre": "Juan Perez",
    "propietario_correo": "juan@test.com",
    "monto_pendiente": 1200.5,
    "fecha_limite": "2026-01-15",
    "estado": "MOROSO"
  }
]
```

## Pantallas

- `frontend/src/views/AdminPaymentsView.tsx`: tarjetas de resumen (al dia / pendientes / morosos /
  vencen hoy, calculadas en el cliente sobre el mismo listado) + tabla con buscador, filtro de
  estado y filtro de fecha.

## Codigo relevante

- `backend/src/services/adminPaymentsService.js`
- `backend/src/controllers/adminPaymentsController.js`
- `backend/src/routes/adminPaymentsRoutes.js`
- `frontend/src/services/paymentsService.ts`
- `frontend/src/types/payments.ts`

## Pruebas

```
cd proyecyo-1/backend
npm install
npm test
```

- **Unitarias** (`backend/src/services/__tests__/adminPaymentsService.test.js`): mapeo de filas,
  calculo de filtros validos/invalidos, armado de la clausula `WHERE`, mockeando
  `backend/src/database/mysql.js` (no se conecta a MySQL real).
- **Funcionales** (`backend/src/routes/__tests__/adminPayments.route.test.js`): peticiones HTTP
  con Supertest contra `createApp()`, mockeando el service para validar el middleware
  `requireAdmin`, el codigo de estado y la propagacion de errores. No sustituyen una prueba de
  extremo a extremo contra la base de datos real del `docker-compose`.
