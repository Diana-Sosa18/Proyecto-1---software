jest.mock("../../database/mysql", () => ({
  query: jest.fn(),
}));

const { query } = require("../../database/mysql");
const { listDelinquentResidents } = require("../adminPaymentsService");
const { listAuthorizedTenants } = require("../adminAuthorizedUsersService");

// Pruebas de seguridad: verifican que las entradas maliciosas de SQL Injection
// se traten SIEMPRE como datos (parametros ?) y nunca como parte de la consulta SQL.
describe("Seguridad - SQL Injection en filtros de busqueda", () => {
  beforeEach(() => {
    query.mockReset();
    query.mockResolvedValue([]);
  });

  const maliciousInput = "'; DROP TABLE USUARIO; --";

  it("adminPayments: la busqueda maliciosa viaja como parametro, no en el SQL", async () => {
    await listDelinquentResidents({ search: maliciousInput });

    const [sql, params] = query.mock.calls[0];

    // El texto malicioso NO debe aparecer incrustado en la consulta.
    expect(sql.toLowerCase()).not.toContain("drop table");
    // La consulta usa marcadores de posicion (?).
    expect(sql).toContain("?");
    // El valor peligroso llega como dato dentro de params (escapado por el driver).
    expect(params.some((value) => String(value).toLowerCase().includes("drop table"))).toBe(true);
  });

  it("usuariosAutorizados: la busqueda maliciosa viaja como parametro, no en el SQL", async () => {
    await listAuthorizedTenants({ search: maliciousInput });

    const [sql, params] = query.mock.calls[0];

    expect(sql.toLowerCase()).not.toContain("drop table");
    expect(sql).toContain("?");
    expect(params.some((value) => String(value).toLowerCase().includes("drop table"))).toBe(true);
  });

  it("adminPayments: un estado invalido es rechazado antes de tocar la base de datos", async () => {
    await expect(
      listDelinquentResidents({ estado: "'; DELETE FROM PAGO; --" }),
    ).rejects.toMatchObject({ status: 400 });
    expect(query).not.toHaveBeenCalled();
  });
});
