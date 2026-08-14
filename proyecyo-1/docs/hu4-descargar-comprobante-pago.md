# HU4 — Descargar comprobante de pago

## Objetivo

Permitir que el residente consulte la información de un pago registrado para su unidad y descargue
un comprobante en formato PDF desde la pantalla `/residente/detalle-financiero`.

## Funcionalidad implementada

- **SCRUM-423 — Agregar botón Descargar comprobante:** cada fila de “Pagos realizados” incluye la
  acción **Descargar PDF**, con indicador de progreso y un mensaje visible si ocurre un error.
- **SCRUM-424 — Generar comprobante PDF:** el backend construye un documento con número de
  comprobante, estado, fecha, concepto, cuota, monto, residente, correo y unidad.
- **SCRUM-425 — Mostrar información del pago:** la tabla muestra servicio, número de comprobante,
  monto, fecha y estado del pago.
- **SCRUM-426 — Validar descarga:** se valida que el identificador sea un entero positivo y que el
  pago pertenezca al residente autenticado. Un residente no puede descargar comprobantes de otra
  unidad. La respuesta se entrega como `application/pdf` y sin caché compartida.
- **SCRUM-429 — Documentar la funcionalidad:** este documento describe el flujo, la API y los
  archivos relevantes.

No se agregaron las tareas de pruebas unitarias (SCRUM-427) ni pruebas funcionales (SCRUM-428).

## Flujo de uso

1. El residente inicia sesión y abre **Cargos y pagos**.
2. En la sección **Pagos realizados**, identifica el pago mediante el número `NXR-########`.
3. Presiona **Descargar PDF**.
4. El navegador descarga `comprobante-NXR-########.pdf`.

## Endpoint

`GET /residente/pagos/:paymentId/comprobante`

Headers de sesión requeridos:

```text
x-user-role: residente
x-user-id: <id_usuario>
```

Respuestas:

| Estado | Descripción |
| --- | --- |
| `200` | PDF del comprobante (`Content-Type: application/pdf`). |
| `400` | El identificador del pago no es válido. |
| `401` | La sesión no contiene un usuario válido. |
| `403` | El rol no es residente. |
| `404` | El pago no existe o no pertenece al residente autenticado. |

La respuesta incluye `Content-Disposition: attachment` y `Cache-Control: private, no-store`.

## Archivos relevantes

- `backend/src/services/residentPaymentReceiptService.js`
- `backend/src/controllers/residentPaymentReceiptController.js`
- `backend/src/routes/residentPaymentReceiptRoutes.js`
- `frontend/src/services/financialDetailService.ts`
- `frontend/src/types/financialDetail.ts`
- `frontend/src/views/ResidenteFinancialDetailView.tsx`
