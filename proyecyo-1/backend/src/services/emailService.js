const { env } = require("../config/env");

async function sendPasswordResetEmail({ to, name, resetUrl }) {
  if (!env.EMAIL_API_URL) {
    if (env.NODE_ENV !== "test") {
      console.warn("EMAIL_API_URL no esta configurada; el enlace de recuperacion no pudo enviarse.");
    }
    return { delivered: false };
  }

  const response = await fetch(env.EMAIL_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(env.EMAIL_API_KEY ? { Authorization: `Bearer ${env.EMAIL_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to,
      subject: "Recupera tu acceso a NexusResidencial",
      text: `Hola ${name || ""}. Usa este enlace para establecer una nueva contrasena: ${resetUrl}`,
      html: `<p>Hola ${String(name || "").replace(/[<>&"']/g, "")},</p><p>Usa el siguiente enlace para establecer una nueva contrasena. Expirara pronto y solo puede utilizarse una vez.</p><p><a href="${resetUrl}">Restablecer contrasena</a></p>`,
    }),
  });

  if (!response.ok) {
    const error = new Error("El proveedor de correo rechazo el mensaje de recuperacion.");
    error.status = 502;
    throw error;
  }

  return { delivered: true };
}

module.exports = { sendPasswordResetEmail };
