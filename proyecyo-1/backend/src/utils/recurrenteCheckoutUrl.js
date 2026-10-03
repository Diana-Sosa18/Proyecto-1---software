function validCheckoutId(value) {
  return typeof value === "string" && value.length <= 191 && /^ch_[A-Za-z0-9_-]+$/.test(value);
}
function validateCheckoutUrl(value, id) {
  if (!validCheckoutId(id) || typeof value !== "string" || value.length > 2048
    || /[\u0000-\u0020\u007f\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "app.recurrente.com" || url.port
      || url.username || url.password || url.search || url.hash
      || url.pathname !== `/checkout-session/${id}`) return null;
    return url.href;
  } catch { return null; }
}
module.exports = { validCheckoutId, validateCheckoutUrl };
