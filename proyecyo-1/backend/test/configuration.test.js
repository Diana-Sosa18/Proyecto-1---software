const assert = require("node:assert/strict");
const test = require("node:test");

const {
  validateVisitSchedulePayload,
  validateVisitTimesAgainstSchedule,
  DEFAULT_VISIT_SCHEDULE,
} = require("../src/services/configurationService");

const baseSchedule = {
  hora_apertura: "06:00",
  hora_cierre: "22:00",
  duracion_maxima_horas: 4,
  activo: true,
  dias_habilitados: [1, 2, 3, 4, 5, 6, 0],
};

test("validateVisitSchedulePayload accepts a valid schedule", () => {
  assert.deepEqual(validateVisitSchedulePayload(baseSchedule), baseSchedule);
});

test("validateVisitSchedulePayload rejects closing time before opening time", () => {
  assert.throws(
    () =>
      validateVisitSchedulePayload({
        ...baseSchedule,
        hora_apertura: "20:00",
        hora_cierre: "08:00",
      }),
    /hora de cierre debe ser mayor/,
  );
});

test("validateVisitSchedulePayload rejects duration greater than allowed window", () => {
  assert.throws(
    () =>
      validateVisitSchedulePayload({
        hora_apertura: "08:00",
        hora_cierre: "10:00",
        duracion_maxima_horas: 4,
        activo: true,
      }),
    /duracion maxima no puede ser mayor/,
  );
});

test("validateVisitSchedulePayload rejects invalid duration values", () => {
  assert.throws(
    () =>
      validateVisitSchedulePayload({
        ...baseSchedule,
        duracion_maxima_horas: 0,
      }),
    /duracion maxima debe ser un entero/,
  );
});

test("validateVisitTimesAgainstSchedule accepts times inside configured window", () => {
  assert.doesNotThrow(() =>
    validateVisitTimesAgainstSchedule("10:00", "12:00", baseSchedule),
  );
});

test("validateVisitTimesAgainstSchedule rejects times outside configured window", () => {
  assert.throws(
    () => validateVisitTimesAgainstSchedule("05:00", "07:00", baseSchedule),
    /horario debe estar entre 06:00 y 22:00/,
  );
});

test("validateVisitTimesAgainstSchedule rejects visits longer than configured duration", () => {
  assert.throws(
    () => validateVisitTimesAgainstSchedule("10:00", "15:00", baseSchedule),
    /no puede durar mas de 4 hora/,
  );
});

test("validateVisitTimesAgainstSchedule rejects visits when schedule is inactive", () => {
  assert.throws(
    () =>
      validateVisitTimesAgainstSchedule("10:00", "11:00", {
        ...baseSchedule,
        activo: false,
      }),
    /autorizaciones de visita estan temporalmente deshabilitadas/,
  );
});

test("validateVisitTimesAgainstSchedule rejects disabled weekdays", () => {
  assert.throws(
    () => validateVisitTimesAgainstSchedule("10:00", "11:00", {
      ...baseSchedule,
      dias_habilitados: [1, 2, 3, 4, 5],
    }, "2026-07-26"),
    /dia seleccionado no esta habilitado/,
  );
});

test("DEFAULT_VISIT_SCHEDULE matches expected seed values", () => {
  assert.deepEqual(DEFAULT_VISIT_SCHEDULE, {
    hora_apertura: "06:00",
    hora_cierre: "22:00",
    duracion_maxima_horas: 4,
    activo: true,
    dias_habilitados: [1, 2, 3, 4, 5, 6, 0],
  });
});
