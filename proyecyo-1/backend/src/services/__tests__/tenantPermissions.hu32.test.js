jest.mock("../../database/mysql", () => ({ query: jest.fn() }));

const fs = require("node:fs");
const path = require("node:path");
const { query } = require("../../database/mysql");
const { listTenantPermissions, UNSUPPORTED_TENANT_PERMISSIONS } = require("../sprintStoriesService");

describe("HU32 permisos del inquilino", () => {
  beforeEach(() => query.mockReset());

  it("no muestra capacidades que el backend no ofrece al inquilino", async () => {
    query.mockResolvedValueOnce([]);
    await listTenantPermissions(9);
    expect(UNSUPPORTED_TENANT_PERMISSIONS).toContain("Reservas de amenidades");
    expect(query.mock.calls[0][0]).toContain("AND nombre NOT IN (?)");
    expect(query.mock.calls[0][1]).toEqual([9, "Reservas de amenidades"]);
  });

  it("el arranque ya no siembra el permiso de amenidades (los registros previos se conservan)", () => {
    const source = fs.readFileSync(path.resolve(__dirname, "../../database/mysql.js"), "utf8");
    expect(source).not.toMatch(/INSERT INTO PERMISO_INQUILINO[\s\S]{0,200}'Reservas de amenidades'/);
    expect(source).not.toMatch(/DELETE FROM PERMISO_INQUILINO/);
    expect(source).toMatch(/INSERT INTO PERMISO_INQUILINO[\s\S]{0,200}'Gestion de visitas'/);
  });
});
