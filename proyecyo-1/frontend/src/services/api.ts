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

function getRequestHeaders(initial?: HeadersInit) {
  const headers = new Headers(initial);
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

  return headers;
}

async function getPayload(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text) as unknown; } catch { return { message: text }; }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: getRequestHeaders(options.headers),
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await getPayload(response);

  if (!response.ok) {
    throw new ApiError(
      (payload as { message?: string } | null)?.message ?? "Error inesperado en la API",
      response.status,
      payload,
    );
  }

  return payload as T;
}

export async function apiDownload(path: string) {
  const response = await fetch(`${API_URL}${path}`, { headers: getRequestHeaders() });
  if (!response.ok) {
    const payload = await getPayload(response);
    throw new ApiError((payload as { message?: string } | null)?.message ?? "No fue posible descargar el archivo.", response.status, payload);
  }
  return response.blob();
}
