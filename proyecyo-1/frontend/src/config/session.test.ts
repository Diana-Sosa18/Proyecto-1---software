import { expect, it } from "vitest";
import { ACTIVITY_THROTTLE_MS, SESSION_TIMEOUT_MS, SESSION_WARNING_MS } from "./session";
it("HU6 centraliza tiempos coherentes", () => {
  expect(SESSION_TIMEOUT_MS).toBeGreaterThan(SESSION_WARNING_MS);
  expect(SESSION_WARNING_MS).toBeGreaterThan(0);
  expect(ACTIVITY_THROTTLE_MS).toBeGreaterThan(0);
});
