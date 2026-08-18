const { payObligation } = require("../services/simulatedPaymentsService");

async function postSimulatedPayment(req, res, next) {
  try {
    const result = await payObligation(req.authUser.id, req.authUser.role, req.body?.id_cuota);
    res.status(201).json(result);
  } catch (error) { next(error); }
}
module.exports = { postSimulatedPayment };
