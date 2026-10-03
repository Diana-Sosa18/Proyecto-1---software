// Optional additions preserve compatibility with existing consumers and historical responses.
export interface FinancialReview {
  sobrepago?: number;
  requiere_revision?: boolean;
}
export interface FinancialBalanceDetails extends FinancialReview {
  capital_pendiente?: number;
  recargo_pendiente?: number;
}
