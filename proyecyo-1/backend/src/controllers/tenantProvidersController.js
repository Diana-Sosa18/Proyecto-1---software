const {
  listTenantProviders,
  getTenantProvidersHistory,
  createTenantProvider,
  updateTenantProvider,
} = require("../services/tenantProvidersService");

async function getTenantProviders(req, res, next) {
  try {
    const providers = await listTenantProviders(req.authUser.id, req.query || {});
    res.status(200).json(providers);
  } catch (error) {
    next(error);
  }
}

async function getTenantProviderHistory(req, res, next) {
  try {
    const history = await getTenantProvidersHistory(req.authUser.id, req.query || {});
    res.status(200).json(history);
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

async function postTenantProvider(req, res, next) {
  try {
    const provider = await createTenantProvider(req.authUser.id, req.body || {});
    res.status(201).json(provider);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getTenantProviders,
  getTenantProviderHistory,
  postTenantProvider,
  patchTenantProvider,
};
