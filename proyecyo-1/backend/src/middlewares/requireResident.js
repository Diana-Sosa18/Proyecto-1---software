const { requireRoles } = require("./requireRoles");
const requireResident = requireRoles(["residente"], "Acceso restringido a residentes.");
const requireResidentOrTenant = requireRoles(["residente", "inquilino"], "Acceso restringido a residentes e inquilinos.");

const requireTenant = requireRoles(["inquilino"], "Acceso restringido a inquilinos.");

module.exports = { requireResident, requireResidentOrTenant, requireTenant };
