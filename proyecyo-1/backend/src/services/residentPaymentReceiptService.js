const PDFDocument = require("pdfkit");

const { query } = require("../database/mysql");

function normalizePaymentId(value) {
  const paymentId = Number(value);

  if (!Number.isInteger(paymentId) || paymentId <= 0) {
    const error = new Error("El identificador del pago es invalido.");
    error.status = 400;
    throw error;
  }

  return paymentId;
}

function paymentReference(paymentId) {
  return `NXR-${String(paymentId).padStart(8, "0")}`;
}

async function getResidentPaymentReceipt(userId, paymentIdInput) {
  const paymentId = normalizePaymentId(paymentIdInput);
  const rows = await query(
    `
      SELECT
        pg.id_pago,
        pg.id_cuota,
        pg.monto_pagado,
        DATE_FORMAT(pg.fecha_pago, '%Y-%m-%d') AS fecha_pago,
        srv.nombre AS servicio,
        cu.monto AS monto_cuota,
        DATE_FORMAT(cu.fecha_limite, '%Y-%m-%d') AS fecha_limite,
        propietario.nombre AS residente_nombre,
        propietario.correo AS residente_correo,
        c.numero,
        c.torre
      FROM PAGO pg
      INNER JOIN CUOTA cu ON cu.id_cuota = pg.id_cuota
      INNER JOIN SERVICIO srv ON srv.id_servicio = cu.id_servicio
      INNER JOIN CASA c ON c.id_casa = cu.id_casa
      INNER JOIN RESIDENTE r ON r.id_residente = c.id_residente
      INNER JOIN USUARIO propietario ON propietario.id_usuario = r.id_usuario
      WHERE pg.id_pago = ?
        AND r.id_usuario = ?
      LIMIT 1
    `,
    [paymentId, userId],
  );

  if (!rows[0]) {
    const error = new Error("No se encontro el pago solicitado para este residente.");
    error.status = 404;
    throw error;
  }

  const row = rows[0];

  return {
    id_pago: Number(row.id_pago),
    id_cuota: Number(row.id_cuota),
    numero_comprobante: paymentReference(row.id_pago),
    servicio: row.servicio,
    monto_pagado: Number(row.monto_pagado || 0),
    monto_cuota: Number(row.monto_cuota || 0),
    fecha_pago: row.fecha_pago,
    fecha_limite: row.fecha_limite,
    residente_nombre: row.residente_nombre,
    residente_correo: row.residente_correo,
    unidad: row.torre ? `${row.torre}-${row.numero}` : row.numero,
  };
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(value) {
  if (!value) {
    return "No registrada";
  }

  return new Intl.DateTimeFormat("es-GT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function drawDetailRow(document, label, value, y, options = {}) {
  const { emphasized = false } = options;
  document
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#64748b")
    .text(label, 58, y, { width: 180 });
  document
    .font(emphasized ? "Helvetica-Bold" : "Helvetica")
    .fontSize(emphasized ? 13 : 10)
    .fillColor(emphasized ? "#047857" : "#0f172a")
    .text(value, 245, y, { width: 290, align: "right" });
}

function createPaymentReceiptPdf(payment) {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({
      size: "LETTER",
      margin: 52,
      info: {
        Title: `Comprobante de pago ${payment.numero_comprobante}`,
        Author: "Nexus Residencial",
        Subject: "Comprobante de pago",
      },
    });
    const chunks = [];

    document.on("data", (chunk) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    document.rect(0, 0, document.page.width, 116).fill("#0f172a");
    document
      .font("Helvetica-Bold")
      .fontSize(21)
      .fillColor("#ffffff")
      .text("NEXUS RESIDENCIAL", 52, 42);
    document
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#cbd5e1")
      .text("Comprobante oficial de pago", 52, 72);
    document
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor("#ffffff")
      .text(payment.numero_comprobante, 350, 54, { width: 194, align: "right" });

    document
      .roundedRect(52, 144, 492, 64, 8)
      .fillAndStroke("#ecfdf5", "#a7f3d0");
    document
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor("#047857")
      .text("PAGO APLICADO", 72, 166);
    document
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#065f46")
      .text("Este documento confirma que el pago fue registrado en el sistema.", 72, 184);

    document
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor("#0f172a")
      .text("Información del pago", 58, 242);
    document.moveTo(58, 266).lineTo(538, 266).strokeColor("#e2e8f0").stroke();

    drawDetailRow(document, "Número de comprobante", payment.numero_comprobante, 286);
    drawDetailRow(document, "Fecha de pago", formatDate(payment.fecha_pago), 314);
    drawDetailRow(document, "Concepto", payment.servicio, 342);
    drawDetailRow(document, "Cuota", `#${payment.id_cuota}`, 370);
    drawDetailRow(document, "Monto pagado", formatCurrency(payment.monto_pagado), 402, {
      emphasized: true,
    });

    document
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor("#0f172a")
      .text("Información del residente", 58, 462);
    document.moveTo(58, 486).lineTo(538, 486).strokeColor("#e2e8f0").stroke();

    drawDetailRow(document, "Nombre", payment.residente_nombre, 506);
    drawDetailRow(document, "Correo", payment.residente_correo, 534);
    drawDetailRow(document, "Unidad", payment.unidad, 562);

    document
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#64748b")
      .text(
        `Documento generado el ${new Intl.DateTimeFormat("es-GT", {
          dateStyle: "long",
          timeStyle: "short",
        }).format(new Date())}. Conserve este comprobante para sus registros.`,
        58,
        666,
        { width: 480, align: "center" },
      );

    document.end();
  });
}

module.exports = {
  createPaymentReceiptPdf,
  getResidentPaymentReceipt,
  paymentReference,
};
