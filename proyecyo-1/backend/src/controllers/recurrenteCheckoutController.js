const { CheckoutError } = require("../services/recurrenteCheckoutErrors");
function checkoutController(service) {
  return async (req, res, next) => {
    try {
      const body = req.body;
      if (!body || typeof body !== "object" || Array.isArray(body)
        || Object.keys(body).length !== 1 || !Object.hasOwn(body, "id_cuota")) throw new CheckoutError("INVALID_QUOTA");
      const checkout = await service.startResidentCheckout(req.authUser.id, body.id_cuota);
      res.status(201).json({ referencia_local: checkout.referencia_local, checkout_url: checkout.checkout_url });
    } catch (error) {
      if (error instanceof CheckoutError) {
        // This class contains only static, known messages: do not forward provider errors or headers.
        res.status(error.status).json({ message: error.message, code: error.code });
      } else { next(error); }
    }
  };
}
module.exports = { checkoutController };
function statusController(service) {
  return async (req, res, next) => {
    try {
      const result = await service.residentCheckoutStatus(req.authUser.id, req.params.reference);
      res.set("Cache-Control", "no-store").json({ referencia_local: result.referencia_local,
        estado: result.estado, mensaje: result.mensaje, accion: result.accion });
    } catch (error) {
      if (error instanceof CheckoutError) res.status(error.status).json({ message: error.message, code: error.code });
      else next(error);
    }
  };
}
function retryController(service) {
  return async (req, res, next) => {
    try {
      if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)
        || Object.keys(req.body).length !== 1 || !Object.hasOwn(req.body, "referencia_local")) {
        throw new CheckoutError("INVALID_CHECKOUT_REFERENCE");
      }
      const result = await service.retryResidentCheckout(req.authUser.id, req.body.referencia_local);
      res.status(201).json({ referencia_local: result.referencia_local, checkout_url: result.checkout_url });
    } catch (error) {
      if (error instanceof CheckoutError) res.status(error.status).json({ message: error.message, code: error.code });
      else next(error);
    }
  };
}
module.exports.statusController = statusController;
module.exports.retryController = retryController;
