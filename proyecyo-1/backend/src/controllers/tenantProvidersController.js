const {
  listTenantProviders,
  updateTenantProvider,
} = require("../services/tenantProvidersService");

async function getTenantProviders(req, res, next) {
  try {
    const providers = await listTenantProviders(req.authUser.id);
    res.status(200).json(providers);
  } catch (error) {
    next(error);
  }
}

async function patchTenantProvider(req, res, next) {
  try {
    const provider = await updateTenantProvider(req.authUser.id, req.params.id, req.body || {});
    res.status(200).json(provider);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getTenantProviders,
  patchTenantProvider,
};
