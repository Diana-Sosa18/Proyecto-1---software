const { getPaymentReceipt, createPaymentReceiptPdf } = require("../services/paymentReceiptService");

async function downloadPaymentReceipt(req, res, next) {
  try {
    const payment = await getPaymentReceipt(req.authUser.id, req.authUser.role, req.params.paymentId);
    const pdf = await createPaymentReceiptPdf(payment);
    res.set({ "Cache-Control": "private, no-store", "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="comprobante-${payment.numero_comprobante}.pdf"`,
      "Content-Length": pdf.length });
    res.status(200).send(pdf);
  } catch (error) { next(error); }
}

module.exports = { downloadPaymentReceipt };
