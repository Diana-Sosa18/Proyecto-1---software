const { env } = require("../config/env");
const { getCurrentSession } = require("../services/authService");
const { verifySessionToken } = require("../services/sessionTokenService");

function unauthorized(message = "Sesion invalida.", status = 401) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getAuthenticatedUserId(req) {
  const authorization = String(req.header("authorization") || "");
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const tokenUserId = verifySessionToken(match?.[1]);
  if (tokenUserId) return tokenUserId;

  // La suite historica usa cabeceras simuladas. Nunca se aceptan fuera de tests.
  if (env.NODE_ENV === "test" || process.env.NODE_TEST_CONTEXT) {
    const testUserId = Number(req.header("x-user-id"));
    return Number.isInteger(testUserId) && testUserId > 0 ? testUserId : null;
  }
  return null;
}

function requireRoles(allowedRoles, message = "Acceso restringido.") {
  return async function authorize(req, _res, next) {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) throw unauthorized();

      let current;
      if ((env.NODE_ENV === "test" || process.env.NODE_TEST_CONTEXT) && !req.header("authorization")) {
        current = { id: userId, role: String(req.header("x-user-role") || "").trim().toLowerCase() };
      } else {
        current = await getCurrentSession(userId);
      }

      if (!allowedRoles.includes(current.role)) throw unauthorized(message, 403);
      req.authUser = { id: current.id, role: current.role };
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = { requireRoles };
