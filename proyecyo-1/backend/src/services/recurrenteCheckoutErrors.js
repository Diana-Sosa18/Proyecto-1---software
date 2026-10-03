const ERRORS = {
  INVALID_CHECKOUT_REFERENCE: [400, "La referencia del checkout no es válida."],
  CHECKOUT_NOT_FOUND: [404, "No se encontró un checkout asociado a tu usuario."],
  INVALID_QUOTA: [400, "Envía únicamente una identificación válida de la cuota."],
  RESIDENT_REQUIRED: [403, "Acceso restringido a residentes autorizados."],
  QUOTA_NOT_FOUND: [404, "La cuota no existe."],
  QUOTA_NOT_OWNED: [403, "La cuota no pertenece a una casa asociada a tu usuario."],
  QUOTA_PAID: [409, "La cuota ya está pagada y no tiene saldo pendiente."],
  FINANCIAL_OVERPAYMENT: [409, "Existe un sobrepago histórico; la cuota requiere revisión antes de cobrar."],
  INVALID_FINANCIAL_AMOUNT: [409, "La cuota contiene importes que requieren revisión antes de cobrar."],
  CHECKOUT_MINIMUM: [422, "El saldo es menor al mínimo de Q5 de Recurrente. No se aumentará el monto de la cuota."],
  CHECKOUT_INCOMPATIBLE: [409, "Existe un checkout que no corresponde al saldo o a la asociación actual de la cuota. Requiere revisión."],
  CHECKOUT_UNCERTAIN: [409, "Existe una operación cuyo resultado requiere verificación. Se bloqueó otro checkout para evitar un doble cobro."],
  CHECKOUT_IN_PROGRESS: [409, "Ya se está preparando un checkout para esta cuota. No se creará otro cobro."],
  CHECKOUT_NOT_USABLE: [409, "El checkout anterior no está disponible para continuar. Su operación requiere verificación."],
  CHECKOUT_SIMULATION_BLOCKED: [409, "Esta cuota tiene una operación Recurrente activa o incierta. No admite un pago simulado."],
  CHECKOUT_NOT_CONFIGURED: [503, "El pago electrónico Sandbox todavía no está configurado."],
  CHECKOUT_SANDBOX_MISMATCH: [503, "No se pudo validar el Sandbox configurado. No se inició el cobro."],
  CHECKOUT_SANDBOX_UNAVAILABLE: [503, "No se pudo verificar el Sandbox con Recurrente. No se envió la creación del checkout."],
  CHECKOUT_PROVIDER_REJECTED: [502, "Recurrente no aceptó la creación del checkout. No se registró un pago."],
  CHECKOUT_PROVIDER_AUTH: [503, "No se pudo validar la configuración de pagos con Recurrente."],
  CHECKOUT_PROVIDER_RATE_LIMIT: [503, "Recurrente limitó temporalmente las solicitudes. Intenta más tarde."],
  CHECKOUT_PROVIDER_UNAVAILABLE: [503, "Recurrente no está disponible. El resultado de la operación requiere verificación antes de otro intento."],
  CHECKOUT_TIMEOUT: [504, "Recurrente no respondió a tiempo. Se bloqueó otro checkout hasta verificar el resultado."],
  CHECKOUT_INVALID_RESPONSE: [502, "No se recibió un checkout válido de Recurrente. La operación requiere verificación."],
  CHECKOUT_PERSISTENCE: [503, "No se pudo guardar el resultado del checkout. No se creará otro cobro hasta verificar la operación."],
};

class CheckoutError extends Error {
  constructor(code, { uncertain = false, checkout = null } = {}) {
    const [status, message] = ERRORS[code] || ERRORS.CHECKOUT_INVALID_RESPONSE;
    super(message);
    this.name = "CheckoutError";
    this.code = ERRORS[code] ? code : "CHECKOUT_INVALID_RESPONSE";
    this.status = status;
    this.uncertain = uncertain;
    // Only validated, allowlisted checkout metadata; never a raw provider response.
    this.checkout = checkout;
  }
}
module.exports = { CheckoutError };
