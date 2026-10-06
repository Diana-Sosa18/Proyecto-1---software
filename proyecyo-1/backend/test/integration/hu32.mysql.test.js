const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { configureTestEnvironment, connect } = require("./support/isolatedMysql");

if (process.env.RUN_PHASE0_MYSQL_TESTS !== "1") test("HU32 necesita el runner MySQL desechable", { skip: true }, () => {});
else {
  const isolation = require("./support/suiteIsolation");
  isolation.assertOwnedSuiteDatabase();
  configureTestEnvironment();
  const db = require("../../src/database/mysql");
  const rules = require("../../src/services/financialRulesService");
  const { createTenantAuthorizationRequest, listGuardDailyAccessHistory } = require("../../src/services/sprintStoriesService");
  const { resolveOwnerAuthorizationRequest, listOwnerAuthorizationRequests } = require("../../src/services/tenantAuthorizationRequestsService");
  const { listNotificationsPage, countUnreadNotifications } = require("../../src/services/notificationsService");

  let conn;
  const tag = `HU32-${randomUUID().slice(0, 8)}`; // Identifica todo lo creado por esta suite.
  const query = async (sql, params = []) => (await conn.query(sql, params))[0];
  const userId = async (correo) => (await query("SELECT id_usuario FROM USUARIO WHERE correo=?", [correo]))[0].id_usuario;
  // 23:30 del 2026-10-04 en Guatemala = 05:30 UTC del 2026-10-05.
  const lateNight = new Date("2026-10-05T05:30:00Z");

  describe("HU32 SQL real en base desechable (sin Recurrente ni BD compartida)", () => {
    before(async () => { conn = await connect(process.env.PHASE0_TEST_DATABASE); });
    // Cerrar ambos pools: si no, el proceso de node --test no termina.
    after(async () => { await conn.end(); await db.pool.end(); });

    describe("Recargos: acción administrativa controlada", () => {
      let residentHouse;
      const quotas = {};
      before(async () => {
        residentHouse = (await query(`SELECT c.id_casa FROM CASA c JOIN RESIDENTE r ON r.id_residente=c.id_residente
          JOIN USUARIO u ON u.id_usuario=r.id_usuario WHERE u.correo='residente@test.com' LIMIT 1`))[0].id_casa;
        const service = (await query("INSERT INTO SERVICIO(nombre,tipo_servicio,descripcion) VALUES(?, 'Mantenimiento', ?)", [`${tag} cuota`, tag])).insertId;
        const add = async (deadline, monto = "100.00") =>
          (await query("INSERT INTO CUOTA(id_servicio,id_casa,monto,fecha_limite) VALUES(?,?,?,?)", [service, residentHouse, monto, deadline])).insertId;
        quotas.overdue = await add("2026-09-01");
        quotas.boundary = await add("2026-10-02"); // vence + 2 dias de gracia = 2026-10-04: aun no aplica "hoy" en Guatemala.
        quotas.future = await add("2026-12-31");
        quotas.paid = await add("2026-09-01");
        const payment = (await query("INSERT INTO PAGO(id_cuota,monto_pagado,fecha_pago) VALUES(?, '100.00', '2026-09-01')", [quotas.paid])).insertId;
        await query("INSERT INTO PAGO_ORIGEN VALUES(?,?,'HISTORICO','historical',NOW(6))", [payment, quotas.paid]);
        await rules.saveRule({ dia_limite: 10, tipo: "PORCENTAJE", porcentaje: 10, monto_fijo: 0, dias_gracia: 2, activo: true, vigente_desde: "2026-01-01" });
      });
      const surcharges = async (id) => query("SELECT monto_recargo, DATE_FORMAT(fecha_aplicacion,'%Y-%m-%d') fecha FROM RECARGO_APLICADO WHERE id_cuota=?", [id]);

      test("aplica solo a cuotas vencidas fuera de gracia con capital pendiente, con fecha de Guatemala", async () => {
        const result = await rules.applySurcharges(1, { now: lateNight });
        assert.equal(result.activo, true);
        assert.equal(result.fecha_revision, "2026-10-04");
        assert.deepEqual(await surcharges(quotas.overdue), [{ monto_recargo: "10.00", fecha: "2026-10-04" }]);
        assert.deepEqual(await surcharges(quotas.boundary), [], "con CURDATE() en UTC (2026-10-05) se habria aplicado");
        assert.deepEqual(await surcharges(quotas.future), []);
        assert.deepEqual(await surcharges(quotas.paid), []);
      });

      test("repetir la acción no duplica recargos (idempotente)", async () => {
        await rules.applySurcharges(1, { now: lateNight });
        await rules.applySurcharges(1, { now: lateNight });
        assert.equal((await surcharges(quotas.overdue)).length, 1);
      });

      test("al día siguiente en Guatemala la cuota límite sí aplica", async () => {
        await rules.applySurcharges(1, { now: new Date("2026-10-05T12:00:00Z") });
        assert.deepEqual(await surcharges(quotas.boundary), [{ monto_recargo: "10.00", fecha: "2026-10-05" }]);
      });

      test("con la regla desactivada no aplica nada", async () => {
        const extra = (await query("INSERT INTO CUOTA(id_servicio,id_casa,monto,fecha_limite) SELECT id_servicio,id_casa,'50.00','2026-08-01' FROM CUOTA WHERE id_cuota=?", [quotas.overdue])).insertId;
        await rules.saveRule({ dia_limite: 10, tipo: "PORCENTAJE", porcentaje: 10, monto_fijo: 0, dias_gracia: 2, activo: false, vigente_desde: "2026-01-01" });
        const result = await rules.applySurcharges(1, { now: lateNight });
        assert.deepEqual(result, { aplicados: 0, activo: false, fecha_revision: "2026-10-04" });
        assert.deepEqual(await surcharges(extra), []);
      });
    });

    describe("Solicitudes de autorización del inquilino", () => {
      let tenant, owner, otherOwner, requestId;
      before(async () => {
        tenant = await userId("inquilino@test.com");
        owner = await userId("residente@test.com");
        const residentType = (await query("SELECT id_tipo_usuario FROM USUARIO WHERE id_usuario=?", [owner]))[0].id_tipo_usuario;
        otherOwner = (await query("INSERT INTO USUARIO(nombre,dpi,correo,password,id_tipo_usuario) VALUES(?,?,?,'x',?)",
          [`${tag} propietario`, `${Date.now()}`.slice(-13), `${tag.toLowerCase()}@test.invalid`, residentType])).insertId;
        const otherResident = (await query("INSERT INTO RESIDENTE(id_usuario) VALUES(?)", [otherOwner])).insertId;
        await query("INSERT INTO CASA(numero,torre,id_residente) VALUES('999','Z',?)", [otherResident]);
        requestId = (await createTenantAuthorizationRequest(tenant, { accion: `${tag} mudanza`, motivo: "Traslado" })).id_solicitud;
      });

      test("un residente de otra unidad no puede verla ni resolverla", async () => {
        assert.equal((await listOwnerAuthorizationRequests(otherOwner, { estado: "TODAS" })).length, 0);
        await assert.rejects(resolveOwnerAuthorizationRequest(otherOwner, requestId, { decision: "APROBADO" }), { status: 404 });
        assert.equal((await query("SELECT estado FROM SOLICITUD_AUTORIZACION_DIGITAL WHERE id_solicitud=?", [requestId]))[0].estado, "PENDIENTE");
      });

      test("el propietario de la unidad la aprueba, se notifica al inquilino y no puede resolverse dos veces", async () => {
        const before = await countUnreadNotifications(tenant);
        assert((await listOwnerAuthorizationRequests(owner)).some((r) => r.id_solicitud === requestId));
        const resolved = await resolveOwnerAuthorizationRequest(owner, requestId, { decision: "APROBADO", respuesta: "Autorizado" });
        assert.equal(resolved.estado, "APROBADO");
        assert.equal(resolved.respuesta, "Autorizado");
        assert.equal(await countUnreadNotifications(tenant), before + 1);
        await assert.rejects(resolveOwnerAuthorizationRequest(owner, requestId, { decision: "RECHAZADO", respuesta: "No" }), { status: 409 });
        assert.equal((await query("SELECT estado FROM SOLICITUD_AUTORIZACION_DIGITAL WHERE id_solicitud=?", [requestId]))[0].estado, "APROBADO");
      });
    });

    describe("Notificaciones paginadas", () => {
      let owner, tenant;
      before(async () => {
        owner = await userId("residente@test.com");
        tenant = await userId("inquilino@test.com");
        for (let i = 0; i < 25; i++) {
          // Pares con el mismo creado_en para probar el desempate por id.
          await query("INSERT INTO NOTIFICACION(id_usuario,tipo,titulo,mensaje,leido,creado_en) VALUES(?,?,?,?,?,?)",
            [owner, i % 5 === 0 ? "COMUNICADO" : "AVISO", `${tag} aviso ${i}`, "m", i % 2 === 0, `2026-01-${String(10 + Math.floor(i / 2)).padStart(2, "0")} 08:00:00`]);
        }
        await query("INSERT INTO NOTIFICACION(id_usuario,tipo,titulo,mensaje,leido) VALUES(?,'COMUNICADO',?, 'm', FALSE)", [tenant, `${tag} ajeno`]);
      });

      test("recorre todas las páginas sin duplicados ni huecos y sin avisos ajenos", async () => {
        const seen = [];
        let cursor = null;
        do {
          const page = await listNotificationsPage(owner, { limit: 7, cursor });
          seen.push(...page.items);
          cursor = page.next_cursor;
        } while (cursor);
        const ids = seen.map((n) => n.id_notificacion);
        assert.equal(new Set(ids).size, ids.length, "sin duplicados");
        const total = Number((await query("SELECT COUNT(*) n FROM NOTIFICACION WHERE id_usuario=?", [owner]))[0].n);
        assert.equal(ids.length, total, "sin huecos: se alcanza el total, no solo 20");
        assert(ids.length > 20);
        assert(seen.every((n) => n.id_usuario === owner));
        assert(!seen.some((n) => n.titulo === `${tag} ajeno`));
      });

      test("los filtros se aplican sobre todo el conjunto, no sobre la primera página", async () => {
        const unread = [];
        let cursor = null;
        do {
          const page = await listNotificationsPage(owner, { filtro: "SIN_LEER", limit: 5, cursor });
          unread.push(...page.items);
          cursor = page.next_cursor;
        } while (cursor);
        assert.equal(unread.length, await countUnreadNotifications(owner));
        assert(unread.every((n) => !n.leido));
        const announcements = (await listNotificationsPage(owner, { filtro: "COMUNICADOS", limit: 50 })).items;
        assert(announcements.every((n) => n.tipo === "COMUNICADO"));
      });
    });

    describe("Historial de garita y zona horaria", () => {
      let house, today;
      before(async () => {
        today = require("../../src/utils/guatemalaTime").guatemalaToday();
        house = (await query("SELECT id_casa FROM CASA ORDER BY id_casa LIMIT 1"))[0].id_casa;
        const add = async (name, estado, ingresoUtc = null) => {
          const visitor = (await query("INSERT INTO VISITANTE(nombre,placa) VALUES(?,?)", [`${tag} ${name}`, "P123ABC"])).insertId;
          const access = (await query("INSERT INTO ACCESO(id_visitante,id_casa,fecha,hora_inicio,hora_fin,tipo_visita,estado_acceso) VALUES(?,?,?,'08:00','23:59','VISITA',?)",
            [visitor, house, today, estado])).insertId;
          if (ingresoUtc) await query("INSERT INTO REGISTRO_ACCESO(id_acceso,hora_ingreso) VALUES(?,?)", [access, ingresoUtc]);
          return access;
        };
        await add("pendiente", "AUTORIZADA");
        await add("cancelada", "CANCELADA");
        await add("rechazada", "RECHAZADA");
        await add("por aprobar", "PENDIENTE_APROBACION");
        await add("dentro", "INGRESO_REGISTRADO", "05:30:00");
      });
      const mine = (rows) => rows.filter((r) => r.visitante.startsWith(tag));

      test("solo AUTORIZADA sin ingreso es PENDIENTE y el filtro Canceladas funciona", async () => {
        const all = mine(await listGuardDailyAccessHistory({ date: today }));
        const byName = Object.fromEntries(all.map((r) => [r.visitante.replace(`${tag} `, ""), r.estado]));
        assert.deepEqual(byName, { pendiente: "PENDIENTE", cancelada: "CANCELADA", rechazada: "RECHAZADA", "por aprobar": "PENDIENTE_APROBACION", dentro: "INGRESO" });
        assert.deepEqual(mine(await listGuardDailyAccessHistory({ date: today, status: "CANCELADA" })).map((r) => r.estado), ["CANCELADA"]);
        assert.deepEqual(mine(await listGuardDailyAccessHistory({ date: today, status: "PENDIENTE" })).map((r) => r.estado), ["PENDIENTE"]);
      });

      test("la hora de ingreso guardada en UTC se devuelve en hora de Guatemala", async () => {
        const inside = mine(await listGuardDailyAccessHistory({ date: today, status: "INGRESO" }));
        assert.equal(inside[0].hora_ingreso, "23:30");
      });
    });
  });
}
