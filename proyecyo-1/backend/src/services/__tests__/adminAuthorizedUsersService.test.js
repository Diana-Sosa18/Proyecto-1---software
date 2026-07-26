jest.mock("../../database/mysql", () => ({
  query: jest.fn(),
}));

const { query } = require("../../database/mysql");
const { listAuthorizedTenants } = require("../adminAuthorizedUsersService");

describe("adminAuthorizedUsersService.listAuthorizedTenants", () => {
  beforeEach(() => {
    query.mockReset();
  });

  it("mapea las filas devueltas por la base de datos al formato esperado", async () => {
    query.mockResolvedValueOnce([
      {
        id_usuario: "7",
        nombre: "Ana Martinez",
        correo: "ana@test.com",
        telefono: "5555-1234",
        unidades: "A-102",
        permisos_activos: "Gestion de visitas||Reservas de amenidades",
        total_permisos_activos: "2",
      },
    ]);

    const result = await listAuthorizedTenants();

    expect(result).toEqual([
      {
        id_usuario: 7,
        nombre: "Ana Martinez",
        correo: "ana@test.com",
        telefono: "5555-1234",
        unidades: "A-102",
        permisos_activos: ["Gestion de visitas", "Reservas de amenidades"],
        total_permisos_activos: 2,
      },
    ]);
  });

  it("devuelve una lista vacia de permisos cuando el inquilino no tiene permisos activos", async () => {
    query.mockResolvedValueOnce([
      {
        id_usuario: "9",
        nombre: "Luis Ramirez",
        correo: "luis@test.com",
        telefono: null,
        unidades: "Sin unidad asignada",
        permisos_activos: null,
        total_permisos_activos: 0,
      },
    ]);

    const result = await listAuthorizedTenants();

    expect(result[0].permisos_activos).toEqual([]);
    expect(result[0].telefono).toBeNull();
  });

  it("solo filtra por inquilinos autorizados cuando no hay busqueda", async () => {
    query.mockResolvedValueOnce([]);

    await listAuthorizedTenants({});

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("i.autorizado = TRUE");
    expect(sql).toContain("fecha_inicio <= CURDATE()");
    expect(sql).toContain("fecha_fin IS NULL OR fecha_fin >= CURDATE()");
    expect(sql).toContain("WHERE 1 = 1");
    expect(params).toEqual([]);
  });

  it("agrega el filtro de busqueda sobre nombre, correo y unidad", async () => {
    query.mockResolvedValueOnce([]);

    await listAuthorizedTenants({ search: "Martinez" });

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("resumen.nombre");
    expect(sql).toContain("resumen.correo");
    expect(sql).toContain("resumen.unidades");
    expect(params).toEqual(["%martinez%", "%martinez%", "%martinez%"]);
  });
});
