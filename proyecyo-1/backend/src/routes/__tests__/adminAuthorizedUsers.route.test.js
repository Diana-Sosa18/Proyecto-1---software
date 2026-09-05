jest.mock("../../services/adminAuthorizedUsersService", () => ({
  listAuthorizedTenants: jest.fn(),
}));

const request = require("supertest");
const { createApp } = require("../../app");
const { listAuthorizedTenants } = require("../../services/adminAuthorizedUsersService");

describe("GET /admin/usuarios-autorizados", () => {
  let app;

  beforeEach(() => {
    listAuthorizedTenants.mockReset();
    app = createApp();
  });

  it("rechaza la peticion sin headers de administrador", async () => {
    const response = await request(app).get("/admin/usuarios-autorizados");

    expect(response.status).toBe(403);
    expect(listAuthorizedTenants).not.toHaveBeenCalled();
  });

  it("devuelve el listado cuando la peticion viene autenticada como admin", async () => {
    const users = [
      {
        id_usuario: 7,
        nombre: "Ana Martinez",
        correo: "ana@test.com",
        telefono: "5555-1234",
        unidades: "A-102",
        permisos_activos: ["Gestion de visitas"],
        total_permisos_activos: 1,
      },
    ];
    listAuthorizedTenants.mockResolvedValueOnce(users);

    const response = await request(app)
      .get("/admin/usuarios-autorizados")
      .set("x-user-role", "admin")
      .set("x-user-id", "1");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(users);
  });

  it("propaga el query param de busqueda al service", async () => {
    listAuthorizedTenants.mockResolvedValueOnce([]);

    await request(app)
      .get("/admin/usuarios-autorizados?search=ana")
      .set("x-user-role", "admin")
      .set("x-user-id", "1");

    expect(listAuthorizedTenants).toHaveBeenCalledWith(expect.objectContaining({ search: "ana" }));
  });

  it("rechaza roles distintos de admin", async () => {
    const response = await request(app)
      .get("/admin/usuarios-autorizados")
      .set("x-user-role", "residente")
      .set("x-user-id", "1");

    expect(response.status).toBe(403);
    expect(listAuthorizedTenants).not.toHaveBeenCalled();
  });
});
