const { verifySessionTokenDetails } = require("../services/sessionTokenService");
const { assertActiveSession } = require("../services/activeSessionsService");
const { getCurrentSession } = require("../services/authService");
const { CheckoutError } = require("../services/recurrenteCheckoutErrors");

async function requireResidentSession(req, _res, next) {
  try {
    const token = String(req.header("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1];
    const details = verifySessionTokenDetails(token);
    if (!details) throw Object.assign(new Error("Sesión inválida. Inicia sesión nuevamente."), { status: 401 });
    await assertActiveSession(details.sub, details.sid);
    const user = await getCurrentSession(details.sub);
    if (user.role !== "residente") throw new CheckoutError("RESIDENT_REQUIRED");
    req.authUser = { id: user.id, role: user.role };
    req.authSessionId = details.sid;
    next();
  } catch (error) { next(error); }
}
module.exports = { requireResidentSession };
