const { createSessionToken, verifySessionToken, verifySessionTokenDetails } = require("../sessionTokenService");

describe("sessionTokenService", () => {
  it("firma y verifica la identidad de la sesion", () => {
    expect(verifySessionToken(createSessionToken(7))).toBe(7);
  });

  it("liga el token con una sesion identificable", () => {
    const details = verifySessionTokenDetails(createSessionToken(7, "session-test"));
    expect(details).toMatchObject({ sub: 7, sid: "session-test" });
  });

  it("rechaza tokens manipulados", () => {
    const token = createSessionToken(7);
    expect(verifySessionToken(`${token}x`)).toBeNull();
    expect(verifySessionToken("7.admin")).toBeNull();
  });
});
