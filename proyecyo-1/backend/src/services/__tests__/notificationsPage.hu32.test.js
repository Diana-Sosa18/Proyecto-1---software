jest.mock("../../database/mysql", () => ({ query: jest.fn() }));

const { query } = require("../../database/mysql");
const { listNotifications, listNotificationsPage } = require("../notificationsService");

const row = (id, creado = "2026-10-05 06:00:00", extra = {}) => ({
  id_notificacion: id, id_usuario: 7, id_acceso: null, tipo: "COMUNICADO", titulo: `Aviso ${id}`,
  mensaje: "m", leido: 0, creado_en: creado, leido_en: null, ...extra,
});

describe("HU32 notificaciones paginadas", () => {
  beforeEach(() => query.mockReset());

  it("el listado reciente no cambia: 20 filas del usuario autenticado", async () => {
    query.mockResolvedValueOnce([]);
    await listNotifications(7);
    expect(query.mock.calls[0][0]).toContain("WHERE n.id_usuario = ?");
    expect(query.mock.calls[0][0]).toContain("LIMIT 20");
    expect(query.mock.calls[0][1]).toEqual([7]);
  });

  it("pide una fila extra y devuelve cursor estable cuando hay más páginas", async () => {
    query.mockResolvedValueOnce([row(30, "2026-10-05 06:00:00"), row(29, "2026-10-05 06:00:00"), row(28, "2026-10-04 06:00:00")]);
    const page = await listNotificationsPage(7, { limit: "2" });
    expect(query.mock.calls[0][0]).toContain("ORDER BY n.creado_en DESC, n.id_notificacion DESC");
    expect(query.mock.calls[0][0]).toContain("LIMIT 3");
    expect(query.mock.calls[0][1]).toEqual([7]);
    expect(page.items.map((item) => item.id_notificacion)).toEqual([30, 29]);
    expect(page.next_cursor).toBe("2026-10-05 06:00:00|29");
  });

  it("sin más filas no devuelve cursor", async () => {
    query.mockResolvedValueOnce([row(5)]);
    await expect(listNotificationsPage(7, {})).resolves.toMatchObject({ next_cursor: null });
    expect(query.mock.calls[0][0]).toContain("LIMIT 21");
  });

  it("el cursor continúa después de la última fila con desempate por id, siempre del mismo usuario", async () => {
    query.mockResolvedValueOnce([]);
    await listNotificationsPage(7, { cursor: "2026-10-05 06:00:00|29" });
    expect(query.mock.calls[0][0]).toContain("AND (n.creado_en < ? OR (n.creado_en = ? AND n.id_notificacion < ?))");
    expect(query.mock.calls[0][1]).toEqual([7, "2026-10-05 06:00:00", "2026-10-05 06:00:00", 29]);
  });

  it.each([
    ["SIN_LEER", "AND n.leido = FALSE"],
    ["COMUNICADOS", "AND n.tipo = 'COMUNICADO'"],
    ["OTROS", "AND n.tipo <> 'COMUNICADO'"],
  ])("el filtro %s se aplica en el backend, no sobre la página cargada", async (filtro, fragment) => {
    query.mockResolvedValueOnce([]);
    await listNotificationsPage(7, { filtro });
    expect(query.mock.calls[0][0]).toContain(fragment);
  });

  it.each([
    [{ filtro: "DROP" }, "filtro"],
    [{ limit: "0" }, "limite"],
    [{ limit: "51" }, "limite"],
    [{ limit: "abc" }, "limite"],
    [{ cursor: "1 OR 1=1" }, "cursor"],
  ])("rechaza parámetros inválidos %j sin consultar", async (options) => {
    await expect(listNotificationsPage(7, options)).rejects.toMatchObject({ status: 400 });
    expect(query).not.toHaveBeenCalled();
  });
});
