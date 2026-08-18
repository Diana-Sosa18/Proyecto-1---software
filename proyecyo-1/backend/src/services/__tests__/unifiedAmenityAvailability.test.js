const { __private__ } = require("../amenitiesReservationsService");

describe("disponibilidad unificada de amenidades", () => {
  test("consulta únicamente amenidades activas y conserva la fecha seleccionada", async () => {
    const loader = jest.fn(async (amenityId, fecha) => ({ amenityId, fecha }));
    const amenities = [
      { id_amenidad: 1, activo: true },
      { id_amenidad: 2, activo: false },
      { id_amenidad: 3, activo: true },
    ];
    const result = await __private__.composeUnifiedAvailability(amenities, "2026-08-20", loader);

    expect(loader).toHaveBeenCalledTimes(2);
    expect(loader).toHaveBeenNthCalledWith(1, 1, "2026-08-20");
    expect(loader).toHaveBeenNthCalledWith(2, 3, "2026-08-20");
    expect(result).toEqual({
      fecha: "2026-08-20",
      amenidades: [
        { amenityId: 1, fecha: "2026-08-20" },
        { amenityId: 3, fecha: "2026-08-20" },
      ],
    });
  });
});
