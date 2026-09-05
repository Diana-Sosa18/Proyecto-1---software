# HU6 — Detalle de cargos y pagos del residente

## Objetivo

Permitir al residente consultar el historial financiero de su unidad: los cargos (cuotas)
asignados, los recargos aplicados por mora y los pagos realizados, con filtros por rango de fecha.
Pantalla: `/residente/detalle-financiero`.

## Regla de negocio

El residente se identifica por su sesión (`x-user-role: residente`, `x-user-id`, middleware
`requireResident`). A partir del `id_usuario` se obtiene su unidad
(`CASA` → `RESIDENTE`) y se arman tres bloques:

- **Cargos** (SCRUM-441): filas de `CUOTA` de la unidad, con el `SERVICIO`, el monto, el total
  pagado (suma de `PAGO`), el recargo aplicado (`RECARGO_APLICADO`), el saldo
  (`monto + recargo - pagado`, nunca negativo) y el estado (`PAGADO`, `PARCIAL`, `PENDIENTE`).
- **Recargos** (SCRUM-442): filas de `RECARGO_APLICADO` de la unidad, con el servicio de la cuota,
  el tipo de regla, el monto original y el monto del recargo.
- **Pagos realizados** (SCRUM-443): filas de `PAGO` de las cuotas de la unidad, con servicio, monto
  pagado y fecha.

El **resumen** agrega: total de cargos, total de recargos, total pagado y saldo pendiente.

### Filtros por fecha (SCRUM-444)

Parámetros `desde` y `hasta` (formato `YYYY-MM-DD`, opcionales). Se aplican a la columna de fecha
propia de cada bloque: `fecha_limite` en cargos, `fecha_aplicacion` en recargos y `fecha_pago` en
pagos.

## Endpoint

`GET /residente/detalle-financiero`

| Param | Valores | Descripción |
|-------|---------|-------------|
| `desde` | `YYYY-MM-DD` | Límite inferior del rango (opcional) |
| `hasta` | `YYYY-MM-DD` | Límite superior del rango (opcional) |

### Ejemplo de respuesta

```json
{
  "unidad": "B-302",
  "periodo": { "desde": "2026-01-01", "hasta": "2026-12-31" },
  "resumen": {
    "total_cargos": 500,
    "total_recargos": 25,
    "total_pagado": 200,
    "saldo_pendiente": 325
  },
  "cargos": [
    {
      "id_cuota": 7,
      "servicio": "Agua potable",
      "monto": 500,
      "pagado": 200,
      "recargo": 25,
      "saldo": 325,
      "fecha_limite": "2026-07-30",
      "estado": "PARCIAL"
    }
  ],
  "recargos": [],
  "pagos": []
}
```

## Pantalla

`frontend/src/views/ResidenteFinancialDetailView.tsx`: filtros de fecha (desde/hasta), tarjetas de
resumen y tres tablas (cargos, recargos, pagos). Se enlaza desde el panel del residente
(`ResidenteView.tsx`) con una tarjeta "Cargos y pagos".

## Código relevante

- `backend/src/services/residentFinancialDetailService.js`
- `backend/src/controllers/residentFinancialDetailController.js`
- `backend/src/routes/residentFinancialDetailRoutes.js`
- `frontend/src/services/financialDetailService.ts`
- `frontend/src/types/financialDetail.ts`
- `frontend/src/views/ResidenteFinancialDetailView.tsx`

## Pruebas

```
cd proyecyo-1/backend
npm install
npm test
```

- **Unitarias** (`backend/test/detalleFinanciero.test.js`, `node:test`): normalización de fechas,
  cálculo de estado del cargo (pagado/parcial/pendiente) y mapeo de cargos, recargos y pagos.
- **Funcionales** (`backend/test/detalleFinanciero.functional.test.js`): peticiones HTTP contra el
  backend levantado (`RUN_FUNCTIONAL_TESTS=1`), validan la estructura de respuesta, los filtros de
  fecha y el rechazo a usuarios que no son residentes.
