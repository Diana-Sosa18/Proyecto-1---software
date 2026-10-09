// Acciones del administrador autenticadas como en produccion: token Bearer real y SIN la
// cabecera heredada x-user-id. Antes, crear un acceso especial o enviar un comunicado
// respondia 401 con una sesion valida y el frontend cerraba la sesion (redirigia al Login).
jest.mock("../../services/activeSessionsService", () => ({
  ...jest.requireActual("../../services/activeSessionsService"),
  assertActiveSession: jest.fn(),
}));
jest.mock("../../services/authService", () => ({
  ...jest.requireActual("../../services/authService"),
  getCurrentSession: jest.fn(),
}));
jest.mock("../../services/specialAccessesService", () => ({
  ...jest.requireActual("../../services/specialAccessesService"),
  createSpecialAccess: jest.fn(),
}));
jest.mock("../../services/announcementsService", () => ({
  ...jest.requireActual("../../services/announcementsService"),
  sendAnnouncement: jest.fn(),
}));
jest.mock("../../services/adminRemindersService", () => ({
  ...jest.requireActual("../../services/adminRemindersService"),
  sendPaymentReminders: jest.fn(),
}));
jest.mock("../../services/amenitiesReservationsService", () => ({
  ...jest.requireActual("../../services/amenitiesReservationsService"),
  createAmenityReservation: jest.fn(),
}));

const request = require("supertest");
const { createApp } = require("../../app");
const { assertActiveSession } = require("../../services/activeSessionsService");
const { getCurrentSession } = require("../../services/authService");
const { createSpecialAccess } = require("../../services/specialAccessesService");
const { sendAnnouncement } = require("../../services/announcementsService");
const { sendPaymentReminders } = require("../../services/adminRemindersService");
const { createAmenityReservation } = require("../../services/amenitiesReservationsService");
const { createSessionToken } = require("../../services/sessionTokenService");

const ADMIN_ID = 7;
const adminToken = createSessionToken(ADMIN_ID, "sesion-admin");
const bearer = (token = adminToken) => ({ Authorization: `Bearer ${token}` });
const httpError = (message, status) => Object.assign(new Error(message), { status });

const specialAccessPayload = {
  nombre: "Visita Especial",
  dpi: "1234567890101",
  placa: "P-123ABC",
  fecha: "2026-10-09",
  hora_inicio: "22:30",
  hora_fin: "23:30",
  id_casa: 3,
  motivo_excepcion: "Entrega de mudanza fuera de horario",
};

describe("Acciones del administrador con token Bearer (sin x-user-id)", () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    assertActiveSession.mockResolvedValue(undefined);
    getCurrentSession.mockImplementation(async (userId) => ({ id: Number(userId), email: "admin@test.com", role: "admin" }));
    app = createApp();
  });

  describe("POST /admin/accesos-especiales", () => {
    it("crea el acceso especial con el administrador de la sesion", async () => {
      createSpecialAccess.mockResolvedValueOnce({ id_acceso: 11, requiere_aprobacion: true });

      const response = await request(app).post("/admin/accesos-especiales").set(bearer()).send(specialAccessPayload);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ id_acceso: 11, requiere_aprobacion: true });
      expect(createSpecialAccess).toHaveBeenCalledWith(ADMIN_ID, specialAccessPayload);
    });

    it("un error de validacion responde 400 con su mensaje y nunca 401", async () => {
      createSpecialAccess.mockRejectedValueOnce(httpError("La fecha es obligatoria y debe tener formato YYYY-MM-DD.", 400));

      const response = await request(app).post("/admin/accesos-especiales").set(bearer()).send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("La fecha es obligatoria y debe tener formato YYYY-MM-DD.");
    });

    it("un conflicto responde 409 y un fallo inesperado 500, sin invalidar la sesion", async () => {
      createSpecialAccess.mockRejectedValueOnce(httpError("Ya existe un acceso en ese horario.", 409));
      const conflict = await request(app).post("/admin/accesos-especiales").set(bearer()).send(specialAccessPayload);
      expect(conflict.status).toBe(409);

      createSpecialAccess.mockRejectedValueOnce(new Error("detalle interno de la base"));
      const failure = await request(app).post("/admin/accesos-especiales").set(bearer()).send(specialAccessPayload);
      expect(failure.status).toBe(500);
      expect(failure.body.message).not.toContain("detalle interno");
    });
  });

  describe("POST /admin/comunicados", () => {
    it("envia el comunicado con el administrador de la sesion", async () => {
      sendAnnouncement.mockResolvedValueOnce({ id_comunicado: 3 });
      const payload = { titulo: "Corte de agua", descripcion: "Sabado de 8 a 12.", tipo_usuario: "TODOS" };

      const response = await request(app).post("/admin/comunicados").set(bearer()).send(payload);

      expect(response.status).toBe(201);
      expect(sendAnnouncement).toHaveBeenCalledWith(ADMIN_ID, payload);
    });

    it("una validacion fallida responde 400, no 401", async () => {
      sendAnnouncement.mockRejectedValueOnce(httpError("El tipo de destinatario es invalido.", 400));

      const response = await request(app).post("/admin/comunicados").set(bearer()).send({});

      expect(response.status).toBe(400);
    });
  });

  describe("POST /admin/recordatorios/generar", () => {
    it("envia los recordatorios con el administrador de la sesion", async () => {
      sendPaymentReminders.mockResolvedValueOnce({ enviados: 2, errores: 0, fecha_revision: "2026-10-08", activo: true });

      const response = await request(app).post("/admin/recordatorios/generar").set(bearer());

      expect(response.status).toBe(201);
      expect(response.body.enviados).toBe(2);
      expect(sendPaymentReminders).toHaveBeenCalledWith(ADMIN_ID);
    });

    it("un fallo del envio responde 500 con mensaje seguro, no 401", async () => {
      sendPaymentReminders.mockRejectedValueOnce(new Error("Lock wait timeout exceeded"));

      const response = await request(app).post("/admin/recordatorios/generar").set(bearer());

      expect(response.status).toBe(500);
      expect(response.body.message).not.toContain("Lock wait");
    });
  });

  describe("POST /admin/reservas/amenidades", () => {
    it("registra la reserva a nombre del administrador de la sesion", async () => {
      createAmenityReservation.mockResolvedValueOnce({ id_reserva: 4 });

      const response = await request(app).post("/admin/reservas/amenidades").set(bearer()).send({ id_amenidad: 1 });

      expect(response.status).toBe(201);
      expect(createAmenityReservation).toHaveBeenCalledWith({ role: "admin", id: ADMIN_ID }, { id_amenidad: 1 });
    });
  });

  describe("las rutas siguen protegidas", () => {
    it("sin token responde 401 y no ejecuta la accion", async () => {
      const response = await request(app).post("/admin/accesos-especiales").send(specialAccessPayload);

      expect(response.status).toBe(401);
      expect(createSpecialAccess).not.toHaveBeenCalled();
    });

    it("un token adulterado responde 401", async () => {
      const response = await request(app).post("/admin/comunicados").set(bearer(`${adminToken}x`)).send({});

      expect(response.status).toBe(401);
      expect(sendAnnouncement).not.toHaveBeenCalled();
    });

    it("una sesion cerrada o expirada responde 401", async () => {
      assertActiveSession.mockRejectedValueOnce(httpError("La sesion fue cerrada o expiro.", 401));

      const response = await request(app).post("/admin/recordatorios/generar").set(bearer());

      expect(response.status).toBe(401);
      expect(sendPaymentReminders).not.toHaveBeenCalled();
    });

    it("un usuario sin rol de administrador recibe 403 y no obtiene acceso", async () => {
      getCurrentSession.mockResolvedValueOnce({ id: 20, email: "residente@test.com", role: "residente" });

      const response = await request(app)
        .post("/admin/accesos-especiales")
        .set(bearer(createSessionToken(20, "sesion-residente")))
        .send(specialAccessPayload);

      expect(response.status).toBe(403);
      expect(createSpecialAccess).not.toHaveBeenCalled();
    });
  });
});
