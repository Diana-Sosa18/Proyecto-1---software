const { requireRoles } = require("./requireRoles");
const requireAdmin = requireRoles(["admin"], "Acceso restringido a administradores.");

module.exports = { requireAdmin };
