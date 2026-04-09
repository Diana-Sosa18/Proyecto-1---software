const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const SESSION_STORAGE_KEY = "nexus.session";

type RequestOptions = RequestInit & {
  body?: unknown;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public payload?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  const rawSession = window.localStorage.getItem(SESSION_STORAGE_KEY);

  if (rawSession) {
    try {
      const session = JSON.parse(rawSession) as { id?: number; email?: string; role?: string };

      if (session.role) {
        headers.set("x-user-role", session.role);
      }

      if (session.email) {
        headers.set("x-user-email", session.email);
      }

      if (session.id) {
        headers.set("x-user-id", String(session.id));
      }
    } catch {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    throw new ApiError(
      (payload as { message?: string } | null)?.message ?? "Error inesperado en la API",
      response.status,
      payload,
    );
  }

  return payload as T;
}
