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
