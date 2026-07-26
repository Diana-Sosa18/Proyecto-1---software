export const SESSION_TIMEOUT_MS = Number(import.meta.env.VITE_SESSION_TIMEOUT_MS || 30 * 60_000);
export const SESSION_WARNING_MS = Number(import.meta.env.VITE_SESSION_WARNING_MS || 60_000);
export const ACTIVITY_THROTTLE_MS = 1_000;
export const LOGOUT_EVENT_KEY = "nexus.logout";
