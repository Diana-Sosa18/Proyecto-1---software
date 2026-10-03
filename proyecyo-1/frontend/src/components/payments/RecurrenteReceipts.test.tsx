import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { RecurrenteReceipts } from "./RecurrenteReceipts";
import { getResidentRecurrenteReceiptsRequest } from "@/services/paymentReceiptService";
vi.mock("@/services/paymentReceiptService", async (importOriginal) => ({ ...await importOriginal<typeof import("@/services/paymentReceiptService")>(), getResidentRecurrenteReceiptsRequest: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
const mount = () => render(<MemoryRouter><RecurrenteReceipts /></MemoryRouter>);
it("carga y sin pagos confirmados no ofrece comprobante", async () => { vi.mocked(getResidentRecurrenteReceiptsRequest).mockResolvedValue([]); mount(); expect(screen.getByRole("status")).toHaveTextContent("Cargando"); await screen.findByText("No hay pagos confirmados con Recurrente."); expect(screen.queryByRole("button")).not.toBeInTheDocument(); });
it("error de historial es seguro", async () => { vi.mocked(getResidentRecurrenteReceiptsRequest).mockRejectedValue(new Error("PRIVATE_TEST")); mount(); expect(await screen.findByRole("alert")).toHaveTextContent("No fue posible"); expect(screen.queryByText("PRIVATE_TEST")).not.toBeInTheDocument(); });
it("refresca el historial cuando Estado de cuenta registra un nuevo abono confirmado", async () => {
  vi.mocked(getResidentRecurrenteReceiptsRequest).mockResolvedValueOnce([]).mockResolvedValueOnce([{ id_pago: 395, id_cuota: 171, numero_comprobante: "NXR-00000395",
    fecha_pago: "2026-10-02", monto_pagado: 5, servicio: "HU13 Sandbox Q5 TEST", titular_nombre: "Residente Demo", unidad: "B-302",
    estado: "CONFIRMADO", moneda: "GTQ", proveedor: "Recurrente", origen: "RECURRENTE", ambiente: "sandbox" }]);
  const view = render(<MemoryRouter><RecurrenteReceipts totalPaid={0} /></MemoryRouter>);
  await screen.findByText("No hay pagos confirmados con Recurrente.");
  view.rerender(<MemoryRouter><RecurrenteReceipts totalPaid={5} /></MemoryRouter>);
  await screen.findByRole("button", { name: "Ver comprobante NXR-00000395" });
  expect(getResidentRecurrenteReceiptsRequest).toHaveBeenCalledTimes(2);
});
