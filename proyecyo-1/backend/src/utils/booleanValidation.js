function ensureBoolean(value, fallback) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  return fallback;
}

module.exports = { ensureBoolean };
