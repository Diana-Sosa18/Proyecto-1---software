jest.mock("../../database/mysql", () => ({ query: jest.fn() }));

const { query } = require("../../database/mysql");
const { listAuditLogs, recordAudit, sanitizeAuditData } = require("../auditService");

describe("auditService", () => {
  beforeEach(() => query.mockReset());

  it("elimina secretos y tokens incluso dentro de objetos anidados", () => {
    expect(sanitizeAuditData({ nombre: "Ana", password: "oculta", nested: { token: "secreto", activo: true } }))
      .toEqual({ nombre: "Ana", nested: { activo: true } });
  });

  it("registra actor, accion, fecha implicita y cambios saneados", async () => {
    query.mockResolvedValueOnce({ insertId: 3 });
    await recordAudit({
      userId: 1,
      action: "USER_UPDATED",
      entity: "USUARIO",
      entityId: 9,
      previousData: { email: "antes@test.com", password: "nunca" },
      newData: { email: "nuevo@test.com", token: "nunca" },
    });
    const params = query.mock.calls[0][1];
    expect(params.slice(0, 4)).toEqual([1, "USER_UPDATED", "USUARIO", "9"]);
    expect(params[4]).not.toContain("password");
    expect(params[5]).not.toContain("token");
  });

  it("aplica filtros parametrizados por usuario, accion y fechas", async () => {
    query.mockResolvedValueOnce([]);
    await listAuditLogs({ userId: "7", action: "USER_UPDATED", from: "2026-09-01", to: "2026-09-30" });
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("a.id_usuario = ?");
    expect(sql).toContain("a.accion = ?");
    // HU32: los dias del filtro son de Guatemala (UTC-6) y creado_en esta en UTC.
    expect(params).toEqual([7, "USER_UPDATED", "2026-09-01 06:00:00", "2026-10-01 06:00:00"]);
  });

  it("rechaza acciones y rangos de fecha no permitidos", async () => {
    await expect(listAuditLogs({ action: "DROP_TABLE" })).rejects.toMatchObject({ status: 400 });
    await expect(listAuditLogs({ from: "2026-10-01", to: "2026-09-01" })).rejects.toMatchObject({ status: 400 });
    expect(query).not.toHaveBeenCalled();
  });
});
