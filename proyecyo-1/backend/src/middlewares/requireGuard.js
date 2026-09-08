const { requireRoles } = require("./requireRoles");
const requireGuard = requireRoles(["guardia"], "Acceso restringido a guardias.");

module.exports = { requireGuard };
