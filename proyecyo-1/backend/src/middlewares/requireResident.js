const { requireRoles } = require("./requireRoles");
const requireResident = requireRoles(["residente"], "Acceso restringido a residentes.");
const requireResidentOrTenant = requireRoles(["residente", "inquilino"], "Acceso restringido a residentes e inquilinos.");

function requireTenant(req, _res, next) {
  const role = String(req.header("x-user-role") || "")
    .trim()
    .toLowerCase();
  const userId = Number(req.header("x-user-id"));

  if (role !== "inquilino") {
    const error = new Error("Acceso restringido a inquilinos.");
    error.status = 403;
    return next(error);
  }

  if (!Number.isInteger(userId) || userId <= 0) {
    const error = new Error("Sesion invalida.");
    error.status = 401;
    return next(error);
  }

  req.authUser = {
    id: userId,
    role,
  };

  return next();
}

module.exports = { requireResident, requireResidentOrTenant, requireTenant };
