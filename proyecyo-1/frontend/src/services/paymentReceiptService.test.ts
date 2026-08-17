import { expect, it, vi } from "vitest";
import { savePaymentReceipt } from "./paymentReceiptService";

it("crea una descarga PDF y libera su URL", () => {
  const click = vi.fn();
  vi.spyOn(document, "createElement").mockReturnValue({ href: "", download: "", click, remove: vi.fn() } as unknown as HTMLAnchorElement);
  vi.spyOn(document.body, "appendChild").mockImplementation((node) => node);
  const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  savePaymentReceipt(new Blob(["%PDF"]), "NXR-1");
  expect(create).toHaveBeenCalled(); expect(click).toHaveBeenCalled(); expect(revoke).toHaveBeenCalledWith("blob:test");
  vi.restoreAllMocks();
});
