const {
  createPaymentReceiptPdf,
  getResidentPaymentReceipt,
} = require("../services/residentPaymentReceiptService");

async function downloadResidentPaymentReceipt(req, res, next) {
  try {
    const payment = await getResidentPaymentReceipt(req.authUser.id, req.params.paymentId);
    const pdf = await createPaymentReceiptPdf(payment);
    const filename = `comprobante-${payment.numero_comprobante}.pdf`;

    res.set({
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": pdf.length,
      "Content-Type": "application/pdf",
    });
    res.status(200).send(pdf);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  downloadResidentPaymentReceipt,
};
