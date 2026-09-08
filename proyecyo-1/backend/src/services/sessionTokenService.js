const crypto = require("crypto");
const { env } = require("../config/env");

const TOKEN_TTL_SECONDS = 8 * 60 * 60;

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signature(payload) {
  return crypto.createHmac("sha256", env.SESSION_SECRET).update(payload).digest("base64url");
}

function createSessionToken(userId) {
  const payload = encode({ sub: Number(userId), exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS });
  return `${payload}.${signature(payload)}`;
}

function verifySessionToken(token) {
  const [payload, suppliedSignature, extra] = String(token || "").split(".");
  if (!payload || !suppliedSignature || extra) return null;

  const expectedSignature = signature(payload);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!Number.isInteger(decoded.sub) || decoded.sub <= 0 || decoded.exp <= Date.now() / 1000) return null;
    return decoded.sub;
  } catch {
    return null;
  }
}

module.exports = { createSessionToken, verifySessionToken };
