import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// HU32: separadores "·" corrompidos como "?" en las vistas de reembolsos (HU18).
const files = [
  "../components/payments/RecurrenteReceipts.tsx",
  "../views/AdminMonthlyFinancialReportView.tsx",
  "../views/InquilinoAccountView.tsx",
  "../views/ResidenteAccountView.tsx",
  "../views/ResidenteFinancialDetailView.tsx",
];

describe("HU32 encoding de textos visibles", () => {
  it.each(files)("%s no contiene separadores corruptos ni caracteres de reemplazo", (relative) => {
    const source = readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
    expect(source).not.toMatch(/ \? (Devuelto|Neto|Cuota|Abono|\{r\.)/);
    expect(source).not.toMatch(/�|Ã|Â/);
    expect(source).toContain("·");
  });
});
