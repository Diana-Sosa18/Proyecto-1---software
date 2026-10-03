const KEYS = ["RECURRENTE_SECRET_KEY", "RECURRENTE_WEBHOOK_SECRET", "RECURRENTE_SANDBOX_ID"];
function loadRecurrenteConfig(source = process.env) {
  const config = { configured: KEYS.every((key) => String(source[key] || "").trim()), enabled: false };
  // Optional in phase 0. Presence of credentials never enables payments or calls the provider.
  for (const key of KEYS) Object.defineProperty(config, key, { value: String(source[key] || "").trim(), enumerable: false });
  return Object.freeze(config);
}
module.exports = { loadRecurrenteConfig, KEYS };
