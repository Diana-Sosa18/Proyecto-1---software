jest.mock("bcryptjs", () => ({ hash: jest.fn(async () => "bcrypt-hash") }));
jest.mock("../../database/mysql", () => ({
  query: jest.fn(),
  pool: { getConnection: jest.fn() },
}));
jest.mock("../emailService", () => ({ sendPasswordResetEmail: jest.fn() }));

const { pool, query } = require("../../database/mysql");
const { sendPasswordResetEmail } = require("../emailService");
const {
  GENERIC_RESPONSE,
  requestPasswordReset,
  resetPassword,
  validateNewPassword,
} = require("../passwordResetService");

describe("passwordResetService", () => {
  beforeEach(() => {
    query.mockReset();
    pool.getConnection.mockReset();
    sendPasswordResetEmail.mockReset();
  });

  it("responde igual cuando el correo no existe", async () => {
    query.mockResolvedValueOnce([]);
    await expect(requestPasswordReset("nadie@test.com")).resolves.toEqual(GENERIC_RESPONSE);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("guarda solamente el hash criptografico del token y envia el enlace", async () => {
    query
      .mockResolvedValueOnce([{ id_usuario: 9, nombre: "Ana", correo: "ana@test.com" }])
      .mockResolvedValueOnce({ affectedRows: 0 })
      .mockResolvedValueOnce({ insertId: 3 });
    sendPasswordResetEmail.mockResolvedValueOnce({ delivered: true });

    await expect(requestPasswordReset("ANA@test.com")).resolves.toEqual(GENERIC_RESPONSE);
    const insertParams = query.mock.calls[2][1];
    expect(insertParams[0]).toBe(9);
    expect(insertParams[1]).toMatch(/^[a-f0-9]{64}$/);
    const resetUrl = sendPasswordResetEmail.mock.calls[0][0].resetUrl;
    expect(resetUrl).toContain("/restablecer-contrasena?token=");
    expect(resetUrl).not.toContain(insertParams[1]);
  });

  it("exige una contrasena robusta", () => {
    expect(() => validateNewPassword("corta1")).toThrow(/entre 8 y 128/);
    expect(validateNewPassword("Nexus2026")).toBe("Nexus2026");
  });

  it("consume el token, cambia la contrasena e invalida las sesiones", async () => {
    const connection = {
      beginTransaction: jest.fn(),
      execute: jest.fn()
        .mockResolvedValueOnce([[{ id_token: 2, id_usuario: 9 }]])
        .mockResolvedValue([{ affectedRows: 1 }]),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    };
    pool.getConnection.mockResolvedValueOnce(connection);

    await expect(resetPassword({ token: "a".repeat(64), password: "Nexus2026" }))
      .resolves.toMatchObject({ message: expect.stringContaining("actualizada") });
    expect(connection.execute.mock.calls[1][1]).toEqual(["bcrypt-hash", 9]);
    expect(connection.execute.mock.calls[2][0]).toContain("PASSWORD_RESET_TOKEN");
    expect(connection.execute.mock.calls[3][0]).toContain("SESION_ACTIVA");
    expect(connection.commit).toHaveBeenCalled();
  });
});
