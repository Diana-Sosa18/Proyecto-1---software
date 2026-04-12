function requireGuard(req, _res, next) {
  const role = String(req.header("x-user-role") || "")
    .trim()
    .toLowerCase();
  const userId = Number(req.header("x-user-id"));

  if (role !== "guardia") {
    const error = new Error("Acceso restringido a guardias.");
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

module.exports = { requireGuard };
