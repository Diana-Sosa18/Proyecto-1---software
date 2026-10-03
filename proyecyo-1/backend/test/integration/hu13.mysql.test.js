const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { configureTestEnvironment, connect } = require("./support/isolatedMysql");

if (process.env.RUN_PHASE0_MYSQL_TESTS !== "1") {
  test("HU13 MySQL necesita base aislada explicita", { skip: true }, () => {});
} else {
  require("./support/suiteIsolation").assertOwnedSuiteDatabase();
  configureTestEnvironment(); // Blanks real provider/email credentials even if a local .env exists.
  const db = require("../../src/database/mysql");
  const { applyRecurrentePreparation, applyRecurrenteCheckoutMigration, applyRecurrenteConfirmationMigration } = require("../../src/database/recurrenteMigration");
  const { createCheckoutService } = require("../../src/services/recurrenteCheckoutService");
  const { createRecurrenteClient } = require("../../src/services/recurrenteClient");
  const { payObligation } = require("../../src/services/simulatedPaymentsService");
  const { listResidentAccountStatement } = require("../../src/services/residentAccountService");
  let connection;
  const query = async (sql, p = []) => (await connection.query(sql, p))[0];
  async function quota(monto = "100.00", recargo = "15.00", paid = "0.00") {
    const id = (await query("INSERT INTO CUOTA(id_servicio,id_casa,monto,fecha_limite) VALUES(1,1,?,'2025-01-10')", [monto])).insertId;
    if (Number(recargo)) await query("INSERT INTO RECARGO_APLICADO(id_cuota,id_casa,tipo_regla,monto_original,monto_recargo,fecha_aplicacion) VALUES(?,1,'FIJO',?,?,'2025-01-15')", [id, monto, recargo]);
    if (Number(paid)) await query("INSERT INTO PAGO(id_cuota,monto_pagado,fecha_pago) VALUES(?,?,'2025-02-01')", [id, paid]);
    return id;
  }
  const rows = (id) => query("SELECT * FROM CHECKOUT_RECURRENTE WHERE id_cuota=? ORDER BY id_checkout", [id]);
  const code = (promise, expected) => assert.rejects(promise, (error) => error.code === expected);
  function fixture({ pool = db.pool, mode = "ok", environment = "sandbox", timeoutMs = 50, postHook } = {}) {
    const calls = [];
    const external = `ch_TEST_${randomUUID().replaceAll("-", "")}`;
    const response = { id: external, status: "unpaid", checkout_url: `https://app.recurrente.com/checkout-session/${external}` };
    const state = { mode, environment, response };
    const fetchImpl = async (url, options) => {
      calls.push({ url, method: options.method, body: options.body && JSON.parse(options.body) });
      if (url.endsWith("/test")) return Response.json({ environment: state.environment, sandbox_id: "sbx_hu13_fixture" });
      if (options.method === "POST") {
        state.response.total_in_cents = JSON.parse(options.body).items[0].amount_in_cents;
        state.response.currency = "GTQ";
        state.response.live_mode = false;
        if (postHook) await postHook();
        if (state.mode === "timeout") return new Promise(() => {});
        if (state.mode === "network") throw new Error("TEST network loss");
        if (state.mode === "500") return Response.json({ ignored: "TEST_PROVIDER_BODY" }, { status: 500 });
        if (state.mode === "400") return Response.json({ ignored: "TEST_PROVIDER_BODY" }, { status: 400 });
        if (state.mode === "no-url") return Response.json({ id: external, status: "unpaid" }, { status: 201 });
        if (state.mode === "invalid") return new Response("broken TEST JSON", { status: 201, headers: { "Content-Type": "application/json" } });
      }
      return Response.json(state.response, { status: options.method === "POST" ? 201 : 200 });
    };
    const client = createRecurrenteClient({ fetchImpl, configuration: () => ({ secretKey: "FAKE_UNIT_KEY_ONLY", sandboxId: "sbx_hu13_fixture", apiBase: "https://app.recurrente.com/api", origin: "http://localhost:5174", timeoutMs }) });
    return { service: createCheckoutService({ pool, client }), calls, state };
  }
  const posts = (f) => f.calls.filter((c) => c.method === "POST");
  async function assertNoFinancialWrite(id) {
    assert.equal(Number((await query("SELECT COUNT(*) n FROM PAGO WHERE id_cuota=?", [id]))[0].n), 0);
    assert.equal(Number((await query("SELECT COUNT(*) n FROM TRANSACCION_RECURRENTE WHERE id_cuota=?", [id]))[0].n), 0);
  }
  describe("HU13 MySQL real + proveedor completamente mockeado", { concurrency: false }, () => {
    before(async () => {
      await require("./support/initializeTestSchema").initializeTestSchema();
      connection = await connect();
      for (const [name, ensure] of Object.entries(db)) if (name.startsWith("ensure")) await ensure();
      await applyRecurrentePreparation(connection); await applyRecurrenteCheckoutMigration(connection);
      await applyRecurrenteConfirmationMigration(connection);
    });
    after(async () => { await connection?.end(); await db.pool.end(); });
    test("002 repetible conserva todas las filas previas y agrega columnas, CHECK e indice", async () => {
      const beforeRows = await query("SELECT * FROM CHECKOUT_RECURRENTE ORDER BY id_checkout");
      await applyRecurrenteCheckoutMigration(connection); await applyRecurrenteCheckoutMigration(connection);
      assert.deepEqual(await query("SELECT * FROM CHECKOUT_RECURRENTE ORDER BY id_checkout"), beforeRows);
      const columns = await query("SELECT COLUMN_NAME name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='CHECKOUT_RECURRENTE'");
      for (const name of ["checkout_url", "sandbox_id", "estado_proveedor", "error_codigo"]) assert(columns.some((c) => c.name === name));
      assert.equal((await query("SELECT COUNT(*) n FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='CHECKOUT_RECURRENTE' AND INDEX_NAME='idx_checkout_cuota_estado'"))[0].n, 2);
      const id = await quota(); const f = fixture(); await f.service.startResidentCheckout(3, id);
      await assert.rejects(query("UPDATE CHECKOUT_RECURRENTE SET estado='INVALID_TEST' WHERE id_cuota=?", [id]), { code: "ER_CHECK_CONSTRAINT_VIOLATED" });
      await assert.rejects(query("UPDATE CHECKOUT_RECURRENTE SET estado_proveedor='INVALID_TEST' WHERE id_cuota=?", [id]), { code: "ER_CHECK_CONSTRAINT_VIOLATED" });
    });
    test("reserva local commit antes del POST, INCIERTO antes de enviar, sin PAGO", async () => {
      const id = await quota(); const f = fixture({ postHook: async () => {
        const [local] = await rows(id); assert.equal(local.estado, "INCIERTO"); assert.equal(local.error_codigo, "CHECKOUT_CREATING");
        assert.equal(local.monto_centavos, 11500); assert.equal(local.id_externo, null);
      } });
      const dto = await f.service.startResidentCheckout(3, id); const [local] = await rows(id);
      assert.equal(local.estado, "PENDIENTE"); assert.equal(local.checkout_url, dto.checkout_url);
      assert.equal(local.sandbox_id, "sbx_hu13_fixture"); assert.equal(local.id_usuario, 3); assert.equal(local.id_residente, 1); assert.equal(local.id_casa, 1);
      assert.equal(local.moneda, "GTQ"); assert.equal(local.ambiente, "sandbox");
      assert.equal(posts(f)[0].body.items[0].amount_in_cents, 11500);
      await assertNoFinancialWrite(id);
    });
    test("dos intentos concurrentes producen un unico POST y registro", async () => {
      const id = await quota(); let release; let started;
      const entered = new Promise((resolve) => { started = resolve; }); const gate = new Promise((resolve) => { release = resolve; });
      const f = fixture({ timeoutMs: 2000, postHook: async () => { started(); await gate; } });
      const first = f.service.startResidentCheckout(3, id); await entered;
      await code(f.service.startResidentCheckout(3, id), "CHECKOUT_UNCERTAIN"); release(); await first;
      assert.equal(posts(f).length, 1); assert.equal((await rows(id)).length, 1); await assertNoFinancialWrite(id);
    });
    test("checkout compatible consulta GET y reutiliza referencia sin otro POST", async () => {
      const id = await quota(); const f = fixture(); const dto = await f.service.startResidentCheckout(3, id);
      delete f.state.response.checkout_url; // Official GET contract omits the hosted URL.
      assert.deepEqual(await f.service.startResidentCheckout(3, id), dto);
      assert.equal(posts(f).length, 1); assert.equal((await rows(id)).length, 1);
      assert(f.calls.some((c) => c.method === "GET" && c.url.includes("/checkouts/ch_")));
    });
    test("saldo cambiado impide reutilizacion y checkout adicional", async () => {
      const id = await quota(); const f = fixture(); await f.service.startResidentCheckout(3, id);
      await query("INSERT INTO PAGO(id_cuota,monto_pagado,fecha_pago) VALUES(?,10,'2025-02-01')", [id]); // TEST historical fixture, never provider confirmation.
      await code(f.service.startResidentCheckout(3, id), "CHECKOUT_INCOMPATIBLE"); assert.equal(posts(f).length, 1);
    });
    for (const mode of ["500", "timeout", "network", "no-url", "invalid"]) test(`${mode} bloquea reintento incluso despues de mucho tiempo`, async () => {
      const id = await quota(); const f = fixture({ mode });
      await assert.rejects(f.service.startResidentCheckout(3, id));
      assert.equal((await rows(id))[0].estado, "INCIERTO");
      await query("UPDATE CHECKOUT_RECURRENTE SET creado_en='2000-01-01' WHERE id_cuota=?", [id]);
      await code(f.service.startResidentCheckout(3, id), "CHECKOUT_UNCERTAIN"); assert.equal(posts(f).length, 1); await assertNoFinancialWrite(id);
    });
    test("fallo de GET deja INCIERTO y conserva identificador externo", async () => {
      const id = await quota(); const f = fixture(); await f.service.startResidentCheckout(3, id);
      const original = (await rows(id))[0].id_externo; f.state.response = { ...f.state.response, id: "ch_wrong_id" };
      await code(f.service.startResidentCheckout(3, id), "CHECKOUT_INVALID_RESPONSE");
      assert.equal((await rows(id))[0].estado, "INCIERTO"); assert.equal((await rows(id))[0].id_externo, original);
      await code(f.service.startResidentCheckout(3, id), "CHECKOUT_UNCERTAIN"); assert.equal(posts(f).length, 1);
    });
    test("Sandbox diferente bloquea POST y error definitivo permite nuevo intento", async () => {
      const id = await quota(); const f = fixture({ environment: "live" });
      await code(f.service.startResidentCheckout(3, id), "CHECKOUT_SANDBOX_MISMATCH"); assert.equal(posts(f).length, 0); assert.equal((await rows(id))[0].estado, "FALLIDO");
      f.state.environment = "sandbox"; await f.service.startResidentCheckout(3, id); assert.equal(posts(f).length, 1);
    });
    test("400 definitivo no se reintenta automaticamente y conserva el fallido", async () => {
      const id = await quota(); const f = fixture({ mode: "400" }); await code(f.service.startResidentCheckout(3, id), "CHECKOUT_PROVIDER_REJECTED");
      assert.equal(posts(f).length, 1); f.state.mode = "ok"; await f.service.startResidentCheckout(3, id);
      assert.deepEqual((await rows(id)).map((r) => r.estado), ["FALLIDO", "PENDIENTE"]); await assertNoFinancialWrite(id);
    });
    for (const [paid, amount, capital, surcharge] of [[0, 11500, 10000, 1500], [10, 10500, 10000, 500], [50, 6500, 6500, 0]]) test(`abono TEST Q${paid}: recargos primero, saldo real para checkout`, async () => {
      const id = await quota("100.00", "15.00", String(paid)); const f = fixture(); await f.service.startResidentCheckout(3, id);
      const [local] = await rows(id); assert.equal(local.monto_centavos, amount); assert.equal(local.capital_centavos, capital); assert.equal(local.recargo_centavos, surcharge);
      // The account service and checkout agree, including historical payments outside a UI period.
      const account = await listResidentAccountStatement(3); assert.equal(account.cuotas.find((q) => q.id_cuota === id).saldo_pendiente, amount / 100);
    });
    for (const [monto, recargo, paid, expected] of [["100", "15", "115", "QUOTA_PAID"], ["100", "15", "120", "FINANCIAL_OVERPAYMENT"], ["4.99", "0", "0", "CHECKOUT_MINIMUM"]]) test(`bloqueo financiero ${expected}`, async () => {
      const id = await quota(monto, recargo, paid); const f = fixture(); await code(f.service.startResidentCheckout(3, id), expected);
      assert.equal((await rows(id)).length, 0); assert.equal(f.calls.length, 0);
    });
    test("Q10.01 equivale exactamente a 1001 centavos", async () => {
      const id = await quota("10.01", "0"); const f = fixture(); await f.service.startResidentCheckout(3, id); assert.equal((await rows(id))[0].monto_centavos, 1001);
    });
    test("cuota ajena no crea registros ni llama proveedor", async () => {
      const id = await quota(); const f = fixture(); await code(f.service.startResidentCheckout(1, id), "QUOTA_NOT_OWNED"); assert.equal(f.calls.length, 0); assert.equal((await rows(id)).length, 0);
    });
    test("simulaciones bloqueadas solo en cuota activa/incierta; otras siguen funcionando", async () => {
      const active = await quota(), uncertain = await quota(), other = await quota();
      await fixture().service.startResidentCheckout(3, active); await assert.rejects(fixture({ mode: "500" }).service.startResidentCheckout(3, uncertain));
      await code(payObligation(3, "residente", active), "CHECKOUT_SIMULATION_BLOCKED");
      await code(payObligation(3, "residente", uncertain), "CHECKOUT_SIMULATION_BLOCKED");
      await assertNoFinancialWrite(active); await assertNoFinancialWrite(uncertain);
      const simulated = await payObligation(3, "residente", other); assert.equal(simulated.estado, "APROBADA"); assert.equal(simulated.total, 115);
    });
    test("simulacion concurrente durante POST no puede abonar la cuota", async () => {
      const id = await quota(); let release; let entered;
      const started = new Promise((resolve) => { entered = resolve; }); const gate = new Promise((resolve) => { release = resolve; });
      const f = fixture({ timeoutMs: 2000, postHook: async () => { entered(); await gate; } });
      const checkout = f.service.startResidentCheckout(3, id); await started;
      await code(payObligation(3, "residente", id), "CHECKOUT_SIMULATION_BLOCKED"); release(); await checkout; await assertNoFinancialWrite(id);
    });
    test("ruta HTTP con sesion real consulta MySQL y crea solo checkout mock", async () => {
      const request = require("supertest");
      const id = await quota(); const f = fixture(); const { createApp } = require("../../src/app");
      const app = createApp({ recurrenteCheckoutService: f.service });
      const { token } = await require("../../src/services/activeSessionsService").createActiveSession(3);
      const result = await request(app).post("/residente/pagos/recurrente/checkout").set("Authorization", `Bearer ${token}`).send({ id_cuota: id }).expect(201);
      assert.equal(Object.keys(result.body).length, 2); assert.equal(result.body.checkout_url, f.state.response.checkout_url);
      await assertNoFinancialWrite(id);
      await request(app).post("/residente/pagos/recurrente/checkout").set("Authorization", `Bearer ${token}`).send({ id_cuota: id, amount_in_cents: 500 }).expect(400);
      assert.equal(posts(f).length, 1);
    });
    test("fixture manual es repetible y conserva pagos, recargos e historial existente", async () => {
      const { seedManualQuota } = require("../../scripts/start-hu13-sandbox");
      // HU14's manual payment already exists on this fixture. Verify that seeding
      // changes no accounting/provider row, rather than assuming an unpaid DB.
      const tables = ["PAGO", "PAGO_ORIGEN", "RECARGO_APLICADO", "CHECKOUT_RECURRENTE", "TRANSACCION_RECURRENTE"];
      const before = await Promise.all(tables.map((table) => query(`SELECT * FROM ${table} ORDER BY 1`)));
      const first = await seedManualQuota(db.pool); assert.equal(await seedManualQuota(db.pool), first);
      const [row] = await query("SELECT monto FROM CUOTA WHERE id_cuota=?", [first]); assert.equal(row.monto, "5.00");
      for (let i = 0; i < tables.length; i++) assert.deepEqual(await query(`SELECT * FROM ${tables[i]} ORDER BY 1`), before[i], tables[i]);
    });
    test("fallo SQL al terminar revierte update, conserva INCIERTO y evita pago/reintento", async () => {
      const id = await quota(); let injected = false;
      const pool = { getConnection: async () => {
        const c = await db.pool.getConnection(); const execute = c.execute.bind(c);
        return { beginTransaction: c.beginTransaction.bind(c), commit: c.commit.bind(c), rollback: c.rollback.bind(c), release: c.release.bind(c),
          execute: async (sql, params) => {
            if (!injected && sql.includes("SET id_externo=?")) { injected = true; await execute("UPDATE CHECKOUT_RECURRENTE SET estado_proveedor='INVALID_TEST' WHERE id_cuota=?", [id]); }
            return execute(sql, params);
          } };
      } };
      const f = fixture({ pool }); await code(f.service.startResidentCheckout(3, id), "CHECKOUT_PERSISTENCE");
      const [local] = await rows(id); assert.equal(local.estado, "INCIERTO"); assert.equal(local.id_externo, f.state.response.id);
      await code(f.service.startResidentCheckout(3, id), "CHECKOUT_UNCERTAIN"); assert.equal(posts(f).length, 1); await assertNoFinancialWrite(id);
    });
    test("identificador externo repetido no puede asociarse a otra cuota ni liberar el cobro", async () => {
      const first = await quota(), second = await quota(); const f = fixture(); await f.service.startResidentCheckout(3, first);
      await code(f.service.startResidentCheckout(3, second), "CHECKOUT_PERSISTENCE");
      assert.equal((await rows(first))[0].estado, "PENDIENTE");
      const [blocked] = await rows(second); assert.equal(blocked.estado, "INCIERTO"); assert.equal(blocked.id_externo, null);
      await code(f.service.startResidentCheckout(3, second), "CHECKOUT_UNCERTAIN"); assert.equal(posts(f).length, 2); await assertNoFinancialWrite(second);
    });
  });
}
