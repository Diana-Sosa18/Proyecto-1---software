const PDFDocument = require("pdfkit");
const { query } = require("../database/mysql");

function normalizePaymentId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error("El identificador del pago es invalido.");
    error.status = 400;
    throw error;
  }
  return id;
}

function paymentReference(id) {
  return `NXR-${String(id).padStart(8, "0")}`;
}

async function getPaymentReceipt(userId, role, paymentIdInput) {
  const paymentId = normalizePaymentId(paymentIdInput);
  const tenantJoin = role === "inquilino"
    ? `INNER JOIN INQUILINO_CASA ic ON ic.id_casa = c.id_casa
       INNER JOIN INQUILINO titular ON titular.id_inquilino = ic.id_inquilino
         AND titular.id_usuario = ? AND titular.autorizado = TRUE`
    : `INNER JOIN RESIDENTE titular ON titular.id_residente = c.id_residente
         AND titular.id_usuario = ?`;
  const rows = await query(
    `SELECT pg.id_pago, pg.id_cuota, pg.monto_pagado,
            DATE_FORMAT(pg.fecha_pago, '%Y-%m-%d') AS fecha_pago,
            srv.nombre AS servicio, cu.monto AS monto_cuota,
            DATE_FORMAT(cu.fecha_limite, '%Y-%m-%d') AS fecha_limite,
            usuario.nombre AS titular_nombre, usuario.correo AS titular_correo,
            c.numero, c.torre
       FROM PAGO pg
       INNER JOIN CUOTA cu ON cu.id_cuota = pg.id_cuota
       INNER JOIN SERVICIO srv ON srv.id_servicio = cu.id_servicio
       INNER JOIN CASA c ON c.id_casa = cu.id_casa
       ${tenantJoin}
       INNER JOIN USUARIO usuario ON usuario.id_usuario = titular.id_usuario
      WHERE pg.id_pago = ? LIMIT 1`,
    [userId, paymentId],
  );
  if (!rows[0]) {
    const error = new Error("No se encontro el pago solicitado para este usuario.");
    error.status = 404;
    throw error;
  }
  const row = rows[0];
  return {
    id_pago: Number(row.id_pago), id_cuota: Number(row.id_cuota),
    numero_comprobante: paymentReference(row.id_pago), servicio: row.servicio,
    monto_pagado: Number(row.monto_pagado || 0), monto_cuota: Number(row.monto_cuota || 0),
    fecha_pago: row.fecha_pago, fecha_limite: row.fecha_limite,
    titular_nombre: row.titular_nombre, titular_correo: row.titular_correo,
    unidad: row.torre ? `${row.torre}-${row.numero}` : row.numero,
  };
}

function createPaymentReceiptPdf(payment) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 52, info: {
      Title: `Comprobante ${payment.numero_comprobante}`, Author: "Nexus Residencial",
    } });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.rect(0, 0, doc.page.width, 112).fill("#0f172a");
    doc.font("Helvetica-Bold").fontSize(21).fillColor("#ffffff").text("NEXUS RESIDENCIAL", 52, 40);
    doc.font("Helvetica").fontSize(10).text("Comprobante oficial de pago", 52, 72);
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(15).text("PAGO APLICADO", 52, 150);
    const rows = [
      ["Comprobante", payment.numero_comprobante], ["Concepto", payment.servicio],
      ["Fecha", payment.fecha_pago], ["Monto pagado", `Q${payment.monto_pagado.toFixed(2)}`],
      ["Titular", payment.titular_nombre], ["Correo", payment.titular_correo], ["Unidad", payment.unidad],
    ];
    rows.forEach(([label, value], index) => {
      const y = 205 + index * 42;
      doc.font("Helvetica").fontSize(10).fillColor("#64748b").text(label, 58, y);
      doc.font("Helvetica-Bold").fillColor("#0f172a").text(String(value || ""), 220, y, { width: 315, align: "right" });
    });
    doc.font("Helvetica").fontSize(8).fillColor("#64748b").text("Documento generado por NexusResidencial.", 58, 650, { width: 480, align: "center" });
    doc.end();
  });
}

module.exports = { getPaymentReceipt, createPaymentReceiptPdf, paymentReference, __private__: { normalizePaymentId } };
