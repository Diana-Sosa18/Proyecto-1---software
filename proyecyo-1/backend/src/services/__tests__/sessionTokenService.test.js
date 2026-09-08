const { createSessionToken, verifySessionToken } = require("../sessionTokenService");

describe("sessionTokenService", () => {
  it("firma y verifica la identidad de la sesion", () => {
    expect(verifySessionToken(createSessionToken(7))).toBe(7);
  });

  it("rechaza tokens manipulados", () => {
    const token = createSessionToken(7);
    expect(verifySessionToken(`${token}x`)).toBeNull();
    expect(verifySessionToken("7.admin")).toBeNull();
  });
});
