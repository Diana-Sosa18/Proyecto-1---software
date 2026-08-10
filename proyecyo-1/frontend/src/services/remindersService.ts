import { apiRequest } from "@/services/api";
import type {
  ReminderConfig,
  ReminderFilters,
  ReminderGenerationResult,
  ReminderRecord,
  ReminderSummary,
} from "@/types/reminders";

function buildReminderQuery(filters: ReminderFilters) {
  const query = new URLSearchParams();

  if (filters.search?.trim()) {
    query.set("search", filters.search.trim());
  }

  if (filters.type && filters.type !== "TODOS") {
    query.set("type", filters.type);
  }

  return query.toString();
}

export function getReminderConfigRequest() {
  return apiRequest<ReminderConfig>("/admin/recordatorios/configuracion");
}

export function saveReminderConfigRequest(config: ReminderConfig) {
  return apiRequest<ReminderConfig>("/admin/recordatorios/configuracion", {
    method: "PUT",
    body: config,
  });
}

export function getReminderSummaryRequest() {
  return apiRequest<ReminderSummary>("/admin/recordatorios/resumen");
}

export function generateRemindersRequest() {
  return apiRequest<ReminderGenerationResult>("/admin/recordatorios/generar", {
    method: "POST",
  });
}

export function getRemindersRequest(filters: ReminderFilters) {
  const query = buildReminderQuery(filters);
  const url = query ? `/admin/recordatorios?${query}` : "/admin/recordatorios";
  return apiRequest<ReminderRecord[]>(url);
}
