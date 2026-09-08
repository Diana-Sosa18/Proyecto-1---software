export async function downloadReport(filters: Record<string, string>) {
  const raw = localStorage.getItem("nexus.session");
  let session: { token?: string } = {};
  try { session = raw ? JSON.parse(raw) : {}; } catch { /* The API validates the session. */ }
  const query = new URLSearchParams(filters);
  const response = await fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:3000"}/admin/reportes/exportar?${query}`, {
    headers: session.token ? { Authorization: `Bearer ${session.token}` } : {},
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message || "No fue posible exportar el reporte.");
  }
  const expectedType = filters.formato === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (!response.headers.get("Content-Type")?.includes(expectedType)) throw new Error("El servidor devolvió un archivo con formato incorrecto.");
  const blob = await response.blob();
  if (!blob.size) throw new Error("El servidor devolvió un archivo vacío.");
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] || `nexus-${filters.reporte}.${filters.formato}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
