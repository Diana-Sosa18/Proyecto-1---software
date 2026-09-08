jest.mock("../../services/adminPaymentsService", () => ({
  listDelinquentResidents: jest.fn(),
}));

const request = require("supertest");
const { createApp } = require("../../app");
const { listDelinquentResidents } = require("../../services/adminPaymentsService");

describe("GET /admin/pagos", () => {
  let app;

  beforeEach(() => {
    listDelinquentResidents.mockReset();
    app = createApp();
  });

  it("rechaza la peticion sin headers de administrador", async () => {
    const response = await request(app).get("/admin/pagos");

    expect(response.status).toBe(401);
    expect(listDelinquentResidents).not.toHaveBeenCalled();
  });

  it("devuelve el listado cuando la peticion viene autenticada como admin", async () => {
    const payments = [
      {
        id_casa: 1,
        unidad: "A-101",
        propietario_nombre: "Juan Perez",
        propietario_correo: "juan@test.com",
        monto_pendiente: 500,
        fecha_limite: "2026-01-01",
        estado: "MOROSO",
      },
    ];
    listDelinquentResidents.mockResolvedValueOnce(payments);

    const response = await request(app)
      .get("/admin/pagos")
      .set("x-user-role", "admin")
      .set("x-user-id", "1");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(payments);
  });

  it("propaga los query params al service", async () => {
    listDelinquentResidents.mockResolvedValueOnce([]);

    await request(app)
      .get("/admin/pagos?search=juan&estado=MOROSO")
      .set("x-user-role", "admin")
      .set("x-user-id", "1");

    expect(listDelinquentResidents).toHaveBeenCalledWith(
      expect.objectContaining({ search: "juan", estado: "MOROSO" }),
    );
  });

  it("traduce errores del service con status a la respuesta HTTP", async () => {
    const error = new Error("El filtro de estado de pago es invalido.");
    error.status = 400;
    listDelinquentResidents.mockRejectedValueOnce(error);

    const response = await request(app)
      .get("/admin/pagos?estado=INVALIDO")
      .set("x-user-role", "admin")
      .set("x-user-id", "1");

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("El filtro de estado de pago es invalido.");
  });
});
