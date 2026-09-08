const { requireRoles } = require("./requireRoles");
const requireNotificationUser = requireRoles(["residente", "inquilino", "guardia"]);

module.exports = { requireNotificationUser };
