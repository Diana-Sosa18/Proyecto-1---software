const { requireRoles } = require("./requireRoles");
const requireResident = requireRoles(["residente"], "Acceso restringido a residentes.");
const requireResidentOrTenant = requireRoles(["residente", "inquilino"], "Acceso restringido a residentes e inquilinos.");

module.exports = { requireResident, requireResidentOrTenant };
