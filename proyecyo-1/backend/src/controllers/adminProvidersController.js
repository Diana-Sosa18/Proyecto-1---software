const {
  listAdminProviders,
  listAdminProviderHistory,
  updateAdminProvider,
} = require("../services/adminProvidersService");

async function getAdminProviders(req, res, next) {
  try {
    const providers = await listAdminProviders(req.query || {});
    res.status(200).json(providers);
  } catch (error) {
    next(error);
  }
}

async function getAdminProvidersHistory(req, res, next) {
  try {
    const history = await listAdminProviderHistory(req.query || {});
    res.status(200).json(history);
  } catch (error) {
    next(error);
  }
}

async function patchAdminProvider(req, res, next) {
  try {
    const provider = await updateAdminProvider(req.params.id, req.body || {}, req.authUser.id);
    res.status(200).json(provider);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAdminProviders,
  getAdminProvidersHistory,
  patchAdminProvider,
};
