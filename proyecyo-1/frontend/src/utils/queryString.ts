export function buildQuery(filters: Record<string, string | number | undefined | null>) {
  const query = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    const normalized = String(value).trim();

    if (!normalized || normalized === "TODOS") {
      return;
    }

    query.set(key, normalized);
  });

  return query.toString();
}
