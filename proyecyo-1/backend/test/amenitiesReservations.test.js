const assert = require("node:assert/strict");
const test = require("node:test");

const {
  MAX_ACTIVE_RESERVATIONS_PER_USER,
  RESERVATION_LIMIT_MESSAGE,
  __private__,
} = require("../src/services/amenitiesReservationsService");

test("amenity reservation limit uses the configured active reservation maximum", () => {
  assert.equal(MAX_ACTIVE_RESERVATIONS_PER_USER, 3);
});

test("reservation limit error exposes a user-facing conflict message", () => {
  assert.throws(
    () => __private__.throwReservationLimitError(),
    (error) => error.status === 409 && error.message === RESERVATION_LIMIT_MESSAGE,
  );
});
