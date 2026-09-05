import { apiRequest } from "@/services/api";
import type { AccountStatement } from "@/types/account";

export function getResidentAccountStatementRequest() {
  return apiRequest<AccountStatement>("/residente/estado-cuenta");
}
