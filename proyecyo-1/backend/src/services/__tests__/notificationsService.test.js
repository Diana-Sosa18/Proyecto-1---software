jest.mock("../../database/mysql", () => ({ query: jest.fn() }));

const { query } = require("../../database/mysql");
const {
  countUnreadNotifications,
  listNotifications,
  markNotificationAsRead,
} = require("../notificationsService");

describe("notificationsService", () => {
  beforeEach(() => query.mockReset());

  it("siempre limita la consulta al usuario autenticado", async () => {
    query.mockResolvedValueOnce([]);
    await listNotifications(27);
    expect(query.mock.calls[0][0]).toContain("WHERE n.id_usuario = ?");
    expect(query.mock.calls[0][1]).toEqual([27]);
  });

  it("cuenta solamente las notificaciones no leidas del usuario", async () => {
    query.mockResolvedValueOnce([{ total: 4 }]);
    await expect(countUnreadNotifications(12)).resolves.toBe(4);
    expect(query.mock.calls[0][1]).toEqual([12]);
  });

  it("no permite marcar una notificacion que pertenece a otra cuenta", async () => {
    query.mockResolvedValueOnce({ affectedRows: 0 }).mockResolvedValueOnce([]);
    await expect(markNotificationAsRead(99, 8)).rejects.toMatchObject({ status: 404 });
    expect(query.mock.calls[0][1]).toEqual([8, 99]);
    expect(query.mock.calls[1][1]).toEqual([8, 99]);
  });
});
