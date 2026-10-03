import type { FinancialReview } from "@/types/financialBalance";
export function FinancialReviewNotice({ sobrepago = 0, requiere_revision = false }: FinancialReview) {
  if (!requiere_revision && sobrepago <= 0) return null;
  const amount = new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" }).format(sobrepago);
  return <p role="alert" className="my-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
    Se detectó un sobrepago de {amount}. Contacte a administración para revisar los abonos registrados.
  </p>;
}
