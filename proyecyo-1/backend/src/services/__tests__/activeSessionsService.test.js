jest.mock("../../database/mysql", () => ({ query: jest.fn() }));

const { query } = require("../../database/mysql");
const {
  assertActiveSession,
  describeDevice,
  listActiveSessions,
  revokeSession,
} = require("../activeSessionsService");

describe("activeSessionsService", () => {
  beforeEach(() => query.mockReset());

  it("identifica informacion basica del dispositivo sin almacenar mas de lo permitido", () => {
    expect(describeDevice("Mozilla/5.0 (Windows NT 10.0) Chrome/120.0")).toMatchObject({
      deviceName: "Chrome en Windows",
    });
  });

  it("rechaza inmediatamente una sesion revocada o vencida", async () => {
    query.mockResolvedValueOnce([]);
    await expect(assertActiveSession(4, "revocada")).rejects.toMatchObject({ status: 401 });
  });

  it("lista solamente sesiones pertenecientes al usuario e identifica la actual", async () => {
    query.mockResolvedValueOnce([{ id_sesion: "actual" }, { id_sesion: "otra" }]);
    const sessions = await listActiveSessions(4, "actual");
    expect(query.mock.calls[0][1]).toEqual([4]);
    expect(sessions).toEqual([
      { id_sesion: "actual", actual: true },
      { id_sesion: "otra", actual: false },
    ]);
  });

  it("no permite cerrar una sesion ajena", async () => {
    query.mockResolvedValueOnce({ affectedRows: 0 });
    await expect(revokeSession(4, "sesion-ajena")).rejects.toMatchObject({ status: 404 });
    expect(query.mock.calls[0][1]).toEqual(["sesion-ajena", 4]);
  });
});
