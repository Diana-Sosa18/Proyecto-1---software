function requireAdmin(req, _res, next) {
  const role = String(req.header("x-user-role") || "").trim().toLowerCase();

  if (role !== "admin") {
    const error = new Error("Acceso restringido a administradores.");
    error.status = 403;
    return next(error);
  }

  return next();
}

module.exports = { requireAdmin };
