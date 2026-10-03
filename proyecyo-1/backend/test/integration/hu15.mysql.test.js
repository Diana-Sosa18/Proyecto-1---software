const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const { configureTestEnvironment, connect } = require("./support/isolatedMysql");

if (process.env.RUN_PHASE0_MYSQL_TESTS !== "1") {
  test("HU15 requiere exclusivamente MySQL TEST aislado", { skip: true }, () => {});
} else {
  require("./support/suiteIsolation").assertOwnedSuiteDatabase();
  configureTestEnvironment();
  const db = require("../../src/database/mysql");
  const migrations = require("../../src/database/recurrenteMigration");
  const { createWebhookService } = require("../../src/services/recurrenteWebhookService");
  const { createWebhookHandler } = require("../../src/controllers/recurrenteWebhookController");
  const { verifyWebhook, inspectEvent } = require("../../src/services/recurrenteWebhookPayload");
  const { createCheckoutService } = require("../../src/services/recurrenteCheckoutService");
  const { createRecurrenteClient } = require("../../src/services/recurrenteClient");
  const { payObligation } = require("../../src/services/simulatedPaymentsService");
  const { listResidentAccountStatement } = require("../../src/services/residentAccountService");
  const { QUOTA_BALANCES_SQL } = require("../../src/services/financialBalance");
  const { configuration, signed, TEST_SANDBOX, paymentPayload } = require("./support/recurrenteWebhookFixtures");
  const { attemptPayload, legacyAttempt } = require("./support/recurrenteAttemptFixtures");
  let connection;
  const query = async (sql, p = []) => (await connection.query(sql, p))[0];
  const balance = async (id) => (await query(`SELECT * FROM (${QUOTA_BALANCES_SQL}) b WHERE id_cuota=?`, [id]))[0];
  const service = createWebhookService();
  function input(payload, options) {
    const f = signed(payload, options), verified = verifyWebhook(f.raw, f.headers, configuration());
    return { ...verified, payload: undefined, event: inspectEvent(verified.payload, TEST_SANDBOX), sandboxId: TEST_SANDBOX };
  }
  const deliver = (payload, options, target = service) => target.receive(input(payload, options));
  const code = (promise, expected) => assert.rejects(promise, (error) => error.code === expected);
  const checkout = async (id) => (await query("SELECT * FROM CHECKOUT_RECURRENTE WHERE id_checkout=?", [id]))[0];
  const transactions = (id) => query("SELECT * FROM TRANSACCION_RECURRENTE WHERE id_cuota=? ORDER BY id_transaccion", [id]);
  const events = (id) => query("SELECT * FROM EVENTO_RECURRENTE WHERE id_checkout=? ORDER BY id_evento", [id]);
  async function fixture({ state = "PENDIENTE", provider = "unpaid", house = 1 } = {}) {
    const id = (await query("INSERT INTO CUOTA(id_servicio,id_casa,monto,fecha_limite) VALUES(1,?,100,'2026-11-10')", [house])).insertId;
    await query("INSERT INTO RECARGO_APLICADO(id_cuota,id_casa,tipo_regla,monto_original,monto_recargo,fecha_aplicacion) VALUES(?,?,'FIJO',100,15,'2026-10-01')", [id, house]);
    const [owner] = await query("SELECT ca.id_residente,r.id_usuario FROM CASA ca JOIN RESIDENTE r ON r.id_residente=ca.id_residente WHERE ca.id_casa=?", [house]);
    const external = `ch_TEST_${randomUUID().replaceAll("-", "")}`;
    const local = { referencia_local: randomUUID(), idempotency_key: randomUUID(), id_externo: external,
      checkout_url: `https://app.recurrente.com/checkout-session/${external}`, id_cuota: id,
      id_usuario: owner.id_usuario, id_residente: owner.id_residente, id_casa: house, monto_centavos: 11500,
      capital_centavos: 10000, recargo_centavos: 1500, moneda: "GTQ", ambiente: "sandbox", sandbox_id: TEST_SANDBOX,
      estado: state, estado_proveedor: provider };
    local.id_checkout = (await query("INSERT INTO CHECKOUT_RECURRENTE SET ?", local)).insertId;
    return { id, local, payload: attemptPayload(local) };
  }
  function provider(f, { status = "unpaid", mode = "ok", getHook, postHook } = {}) {
    const calls = [], state = { status, mode, environment: "sandbox", sandboxId: TEST_SANDBOX };
    const fetchImpl = async (url, options) => {
      calls.push({ path: new URL(url).pathname, method: options.method });
      if (url.endsWith("/test")) return Response.json({ environment: state.environment, sandbox_id: state.sandboxId });
      if (options.method === "GET") {
        if (getHook) await getHook();
        if (state.mode === "timeout") return new Promise(() => {});
        if (state.mode === "500") return Response.json({ ignored: "TEST" }, { status: 500 });
        if (state.mode === "invalid") return Response.json({ id: f.local.id_externo, status: "guessed" });
        return Response.json({ id: f.local.id_externo, status: state.status, currency: "GTQ",
          total_in_cents: f.local.monto_centavos, live_mode: false });
      }
      if (postHook) await postHook();
      const external = `ch_TEST_${randomUUID().replaceAll("-", "")}`;
      const item = JSON.parse(options.body).items[0];
      return Response.json({ id: external, status: "unpaid", currency: "GTQ", total_in_cents: item.amount_in_cents,
        live_mode: false, checkout_url: `https://app.recurrente.com/checkout-session/${external}` }, { status: 201 });
    };
    const client = createRecurrenteClient({ fetchImpl, configuration: () => ({ secretKey: "HU15_FAKE_KEY_ONLY", sandboxId: TEST_SANDBOX,
      apiBase: "https://app.recurrente.com/api", origin: "http://127.0.0.1:5174", timeoutMs: mode === "timeout" ? 30 : 3000 }) });
    return { calls, state, service: createCheckoutService({ client }) };
  }
  const retry = (f, p) => p.service.retryResidentCheckout(3, f.local.referencia_local);
  const posts = (p) => p.calls.filter((c) => c.method === "POST");
  async function unchanged(f) {
    assert.equal((await query("SELECT COUNT(*) n FROM PAGO WHERE id_cuota=?", [f.id]))[0].n, 0);
    assert.equal((await query("SELECT COUNT(*) n FROM PAGO_ORIGEN WHERE id_cuota=?", [f.id]))[0].n, 0);
    const b = await balance(f.id);
    assert.equal(Number(b.saldo_pendiente), 115);
    assert.equal(Number(b.capital_pendiente), 100);
    assert.equal(Number(b.recargo_pendiente), 15);
    const account = await listResidentAccountStatement(3), q = account.cuotas.find((q) => q.id_cuota === f.id);
    assert.notEqual(q.estado, "PAGADA"); assert.equal(q.saldo_pendiente, 115);
  }
  function failingPool(pattern) {
    let fired = false;
    return { getConnection: async () => {
      const c = await db.pool.getConnection(), execute = c.execute.bind(c), release = c.release.bind(c);
      c.execute = (sql, args) => {
        if (!fired && pattern.test(sql)) { fired = true; return execute("SELECT missing_hu15_test_column FROM CUOTA LIMIT 1"); }
        return execute(sql, args);
      };
      c.release = () => { c.execute = execute; c.release = release; release(); };
      return c;
    } };
  }
  async function withHttp(p, fn, target = service) {
    const app = require("../../src/app").createApp({ recurrenteWebhookHandler: createWebhookHandler({ configuration, service: target }), recurrenteCheckoutService: p.service });
    const server = app.listen(0, "127.0.0.1"); await new Promise((resolve) => server.once("listening", resolve));
    try {
      const { token } = await require("../../src/services/activeSessionsService").createActiveSession(3);
      return await fn(`http://127.0.0.1:${server.address().port}`, token);
    } finally { await new Promise((resolve) => server.close(resolve)); }
  }
  describe("HU15 MySQL TEST + proveedor mock + HTTP local", { concurrency: false }, () => {
    before(async () => {
      await require("./support/initializeTestSchema").initializeTestSchema(); connection = await connect();
      for (const [name, ensure] of Object.entries(db)) if (name.startsWith("ensure")) await ensure();
      await migrations.applyRecurrentePreparation(connection); await migrations.applyRecurrenteCheckoutMigration(connection);
      await migrations.applyRecurrenteConfirmationMigration(connection); await migrations.applyRecurrenteAttemptsMigration(connection);
    });
    after(async () => { await connection?.end(); await db.pool.end(); });
    test("004 aditiva repetible conserva todas las filas anteriores", async () => {
      const tables = ["PAGO", "PAGO_ORIGEN", "CHECKOUT_RECURRENTE", "TRANSACCION_RECURRENTE", "EVENTO_RECURRENTE"];
      const before = await Promise.all(tables.map((t) => query(`SELECT * FROM ${t} ORDER BY 1`)));
      await migrations.applyRecurrenteAttemptsMigration(connection); await migrations.applyRecurrenteAttemptsMigration(connection);
      for (let i = 0; i < tables.length; i++) assert.deepEqual(await query(`SELECT * FROM ${tables[i]} ORDER BY 1`), before[i]);
      assert.doesNotMatch(fs.readFileSync(migrations.ATTEMPTS_MIGRATION_PATH, "utf8"), /\bDROP\b|\bDELETE\b|\bUPDATE\b|\bTRUNCATE\b/i);
    });
    for (const [name, options, state, reason] of [
      ["rechazo", {}, "FALLIDA", "BANK_DECLINED"], ["fallo", { reason: "No fue posible procesar el intento" }, "FALLIDA", "INTENT_FAILED"],
      ["cancelación", { canceled: true }, "CANCELADA", "INTENT_CANCELED"],
    ]) test(`${name}: intento persistido, sin PAGO, sin cambio de saldo/cuota/checkout`, async () => {
      const f = await fixture(); f.payload = attemptPayload(f.local, options); const original = await checkout(f.local.id_checkout);
      assert.equal(await deliver(f.payload), "processed"); await unchanged(f);
      const [t] = await transactions(f.id), [e] = await events(f.local.id_checkout);
      assert.equal(t.estado, state); assert.equal(t.motivo_codigo, reason); assert(t.motivo_sanitizado);
      assert.equal(t.id_pago, null); assert.equal(t.confirmado_en, null); assert.equal(t.capital_aplicado_centavos, null); assert.equal(t.recargo_aplicado_centavos, null);
      assert.equal(t.id_externo, f.payload.id); assert.equal(t.fecha_proveedor_original, f.payload.created_at);
      assert.equal(t.fecha_proveedor_utc, "2026-10-02 18:30:00.123456"); assert(t.finalizado_en);
      assert.equal(e.estado, "PROCESADO"); assert.equal(e.resultado_intento, state); assert.equal(e.id_evento, t.id_evento);
      assert.deepEqual(await checkout(f.local.id_checkout), original);
    });
    test("motivo malicioso firmado no persiste PAN, CVC, datos personales o credenciales", async () => {
      const f = await fixture(); f.payload.details.failure_reason = "El banco rechazó TEST PAN 4111111111111111 CVC 123 sk_test_FAKE_ONLY whsec_FAKE_ONLY email@example.test";
      await deliver(f.payload);
      const [t] = await transactions(f.id), [e] = await events(f.local.id_checkout);
      for (const r of [t, e]) assert.doesNotMatch(r.motivo_sanitizado, /411111|123|CVC|sk_test|whsec|@/);
      await unchanged(f);
    });
    test("legacy mínimo registra evidencia firmada en inbox sin inventar transacción canónica", async () => {
      const f = await fixture(); const p = legacyAttempt(f.payload, { canonical: false });
      assert.equal(await deliver(p), "processed"); assert.equal((await transactions(f.id)).length, 0);
      const [e] = await events(f.local.id_checkout); assert.equal(e.id_operacion_externa, p.id); assert.equal(e.resultado_intento, "FALLIDA");
      assert.equal(e.error_codigo, "WEBHOOK_CANONICAL_INTENT_UNAVAILABLE"); await unchanged(f);
    });
    test("dos entregas concurrentes del mismo svix-id generan un solo intento", async () => {
      const f = await fixture(), svixId = `msg_TEST_${randomUUID()}`;
      assert.deepEqual((await Promise.all([deliver(f.payload, { svixId }), deliver(f.payload, { svixId })])).sort(), ["duplicate", "processed"]);
      assert.equal((await transactions(f.id)).length, 1); assert.equal((await events(f.local.id_checkout)).length, 1); await unchanged(f);
    });
    test("distintos svix-id con el mismo intento no duplican transacción", async () => {
      const f = await fixture(); assert.equal(await deliver(f.payload), "processed"); assert.equal(await deliver(f.payload), "duplicate");
      assert.equal((await transactions(f.id)).length, 1); assert.equal((await events(f.local.id_checkout)).length, 2); await unchanged(f);
    });
    test("legacy y unificado con correlación demostrable convergen concurrentemente", async () => {
      const f = await fixture(); const result = await Promise.all([deliver(f.payload), deliver(legacyAttempt(f.payload))]);
      assert.deepEqual(result.sort(), ["duplicate", "processed"]); assert.equal((await transactions(f.id)).length, 1); await unchanged(f);
    });
    test("mismo svix-id con body diferente responde conflicto y no altera intento", async () => {
      const f = await fixture(), svixId = `msg_TEST_${randomUUID()}`; await deliver(f.payload, { svixId });
      await code(deliver({ ...f.payload, status: "canceled", event_type: "intent.canceled" }, { svixId }), "WEBHOOK_EVENT_CONFLICT");
      assert.equal((await transactions(f.id))[0].estado, "FALLIDA"); await unchanged(f);
    });
    test("HU14 éxito después de otro intento fallido del mismo checkout confirma una sola aplicación", async () => {
      const f = await fixture(); await deliver(f.payload);
      const succeeded = paymentPayload(f.local); assert.equal(await deliver(succeeded), "processed"); assert.equal(await deliver(succeeded), "duplicate");
      const t = await transactions(f.id); assert.equal(t.length, 2); assert.equal(t.filter((r) => r.id_pago).length, 1);
      const confirmed = t.find((r) => r.id_pago); assert.equal(confirmed.estado, "CONFIRMADA"); assert.equal(confirmed.capital_aplicado_centavos, 10000); assert.equal(confirmed.recargo_aplicado_centavos, 1500);
      assert.equal((await query("SELECT COUNT(*) n FROM PAGO WHERE id_cuota=?", [f.id]))[0].n, 1);
      assert.equal(Number((await balance(f.id)).saldo_pendiente), 0); assert.equal((await checkout(f.local.id_checkout)).estado, "CONFIRMADO");
    });
    test("fallo contradictorio no degrada una transacción ya confirmada", async () => {
      const f = await fixture(), success = paymentPayload(f.local); await deliver(success);
      f.payload.id = success.id; f.payload.created_at = success.created_at; f.payload.payment = success.payment;
      assert.equal(await deliver(f.payload), "review"); assert.equal((await transactions(f.id))[0].estado, "CONFIRMADA");
      assert.equal((await checkout(f.local.id_checkout)).estado, "CONFIRMADO"); assert.equal(Number((await balance(f.id)).saldo_pendiente), 0);
    });
    test("legacy de fallo con checkout paid no envenena el intento canónico que confirmará HU14", async () => {
      const f = await fixture(), legacy = legacyAttempt(f.payload); legacy.checkout.status = "paid";
      assert.equal(await deliver(legacy), "review"); assert.equal((await transactions(f.id)).length, 0); await unchanged(f);
      const success = paymentPayload(f.local, { id: f.payload.id }); assert.equal(await deliver(success), "processed");
      assert.equal((await transactions(f.id))[0].estado, "CONFIRMADA"); assert.equal(Number((await balance(f.id)).saldo_pendiente), 0);
    });
    for (const [name, change] of [
      ["Sandbox ajeno", { sandbox_id: "sbx_OTHER" }], ["producción", { live_mode: true }], ["evento desconocido", { event_type: "other.failed" }],
    ]) test(`${name} no genera intento ni efecto financiero`, async () => {
      const f = await fixture(); assert.equal(await deliver({ ...f.payload, ...change }), "ignored");
      assert.equal((await transactions(f.id)).length, 0); await unchanged(f);
    });
    for (const [name, change] of [
      ["monto distinto", { amount_in_cents: 500 }], ["moneda distinta", { currency: "USD" }], ["fecha inválida", { created_at: "sin-fecha" }],
    ]) test(`${name} queda en revisión sin desbloquear checkout`, async () => {
      const f = await fixture(); assert.equal(await deliver({ ...f.payload, ...change }), "review");
      assert.equal((await transactions(f.id)).length, 0); assert.equal((await checkout(f.local.id_checkout)).estado, "PENDIENTE"); await unchanged(f);
    });
    test("cuota/propietario inconsistente no registra intento sobre otra persona", async () => {
      const f = await fixture(); await query("UPDATE CHECKOUT_RECURRENTE SET id_usuario=4 WHERE id_checkout=?", [f.local.id_checkout]);
      assert.equal(await deliver(f.payload), "review"); assert.equal((await transactions(f.id)).length, 0); await unchanged(f);
    });
    for (const pattern of [/^INSERT INTO TRANSACCION_RECURRENTE/, /^UPDATE EVENTO_RECURRENTE SET estado=\?,error_codigo=/]) {
      test(`rollback después de ${pattern} conserva saldo y permite reentrega segura`, async () => {
        const f = await fixture(), svixId = `msg_TEST_${randomUUID()}`, target = createWebhookService({ pool: failingPool(pattern) });
        await code(deliver(f.payload, { svixId }, target), "WEBHOOK_RETRY");
        assert.equal((await transactions(f.id)).length, 0); await unchanged(f);
        const [e] = await query("SELECT * FROM EVENTO_RECURRENTE WHERE svix_id=?", [svixId]);
        assert.equal(e.estado, "FALLIDO"); assert.equal(e.resultado_intento, null);
        assert.equal(await deliver(f.payload, { svixId }), "processed"); assert.equal((await transactions(f.id)).length, 1); await unchanged(f);
      });
    }
    test("unpaid reutiliza la misma URL: fallo no libera otro checkout", async () => {
      const f = await fixture(); await deliver(f.payload); const p = provider(f);
      const dto = await retry(f, p); assert.equal(dto.referencia_local, f.local.referencia_local); assert.equal(dto.checkout_url, f.local.checkout_url);
      assert.equal(posts(p).length, 0); assert.equal(p.calls.filter((c) => c.path === "/api/test").length, 1); await unchanged(f);
    });
    test("cancelación de intento también reutiliza solo el checkout unpaid", async () => {
      const f = await fixture(); await deliver(attemptPayload(f.local, { canceled: true })); const p = provider(f);
      assert.equal((await retry(f, p)).referencia_local, f.local.referencia_local); assert.equal(posts(p).length, 0); await unchanged(f);
    });
    for (const status of ["paid", "payment_in_progress"]) test(`${status} bloquea retry nuevo y no confirma PAGO desde GET`, async () => {
      const f = await fixture(); await deliver(f.payload); const p = provider(f, { status });
      await code(retry(f, p), "CHECKOUT_NOT_USABLE"); assert.equal(posts(p).length, 0);
      assert.equal((await checkout(f.local.id_checkout)).estado, "PENDIENTE");
      assert.equal((await checkout(f.local.id_checkout)).estado_proveedor, status); await unchanged(f);
    });
    test("expired verificado crea exactamente un nuevo checkout, no PAGO", async () => {
      const f = await fixture(); await deliver(f.payload); const p = provider(f, { status: "expired" }); const dto = await retry(f, p);
      assert.notEqual(dto.referencia_local, f.local.referencia_local); const old = await checkout(f.local.id_checkout);
      assert.equal(old.estado, "EXPIRADO"); assert.equal(old.estado_proveedor, "expired"); assert(old.verificado_en);
      assert.equal(posts(p).length, 1); assert.equal((await query("SELECT COUNT(*) n FROM CHECKOUT_RECURRENTE WHERE id_cuota=?", [f.id]))[0].n, 2); await unchanged(f);
    });
    test("retry recalcula saldo cambiado tras verificar expired: recargos primero", async () => {
      const f = await fixture(); await query("INSERT INTO PAGO(id_cuota,monto_pagado,fecha_pago) VALUES(?,50,'2024-01-01')", [f.id]);
      const p = provider(f, { status: "expired" }); const dto = await retry(f, p);
      const [local] = await query("SELECT * FROM CHECKOUT_RECURRENTE WHERE referencia_local=?", [dto.referencia_local]);
      assert.equal(local.monto_centavos, 6500); assert.equal(local.recargo_centavos, 0); assert.equal(local.capital_centavos, 6500);
      assert.equal((await query("SELECT COUNT(*) n FROM PAGO WHERE id_cuota=?", [f.id]))[0].n, 1);
    });
    test("checkout unpaid incompatible no se reutiliza ni crea otro", async () => {
      const f = await fixture(); await query("INSERT INTO PAGO(id_cuota,monto_pagado,fecha_pago) VALUES(?,50,'2024-01-01')", [f.id]);
      const p = provider(f); await code(retry(f, p), "CHECKOUT_INCOMPATIBLE"); assert.equal(posts(p).length, 0);
      assert.equal((await checkout(f.local.id_checkout)).estado, "PENDIENTE");
    });
    test("dos retries concurrentes durante GET producen una sola verificación y ningún POST", async () => {
      const f = await fixture(); let entered, release;
      const started = new Promise((r) => { entered = r; }), gate = new Promise((r) => { release = r; });
      const p = provider(f, { getHook: async () => { entered(); await gate; } });
      const a = retry(f, p); await started; await code(retry(f, p), "CHECKOUT_UNCERTAIN"); release(); await a;
      assert.equal(posts(p).length, 0); assert.equal(p.calls.filter((c) => c.path.includes("/checkouts/")).length, 1); await unchanged(f);
    });
    test("dos retries concurrentes durante el POST sucesor nunca crean dos nuevos checkouts", async () => {
      const f = await fixture(); let entered, release;
      const started = new Promise((r) => { entered = r; }), gate = new Promise((r) => { release = r; });
      const p = provider(f, { status: "expired", postHook: async () => { entered(); await gate; } });
      const a = retry(f, p); await started; await code(retry(f, p), "CHECKOUT_UNCERTAIN"); release(); await a;
      assert.equal(posts(p).length, 1); assert.equal((await query("SELECT COUNT(*) n FROM CHECKOUT_RECURRENTE WHERE id_cuota=?", [f.id]))[0].n, 2); await unchanged(f);
    });
    test("rollback al reservar sucesor revierte expiración y conserva bloqueo incierto", async () => {
      const f = await fixture(), p = provider(f, { status: "expired" });
      const failing = createCheckoutService({ pool: failingPool(/^INSERT INTO CHECKOUT_RECURRENTE/), client: {
        sandboxId: () => TEST_SANDBOX,
        getCheckout: async () => ({ id_externo: f.local.id_externo, checkout_url: f.local.checkout_url, estado_proveedor: "expired" }),
        createCheckout: async () => { throw new Error("TEST POST forbidden after SQL rollback"); },
      } });
      await code(failing.retryResidentCheckout(3, f.local.referencia_local), "CHECKOUT_PERSISTENCE");
      const old = await checkout(f.local.id_checkout); assert.equal(old.estado, "INCIERTO"); assert.equal(old.estado_proveedor, "unpaid"); assert.equal(old.verificado_en, null);
      assert.equal((await query("SELECT COUNT(*) n FROM CHECKOUT_RECURRENTE WHERE id_cuota=?", [f.id]))[0].n, 1);
      await code(retry(f, p), "CHECKOUT_UNCERTAIN"); assert.equal(p.calls.length, 0); await unchanged(f);
    });
    test("fallo terminal local con ID externo no es evidencia para un checkout nuevo", async () => {
      const f = await fixture({ state: "FALLIDO" }), p = provider(f);
      const dto = await retry(f, p); assert.equal(dto.referencia_local, f.local.referencia_local); assert.equal(posts(p).length, 0); await unchanged(f);
    });
    test("EXPIRADO local sin verificación debe consultar al proveedor y conservar unpaid", async () => {
      const f = await fixture({ state: "EXPIRADO", provider: "expired" }), p = provider(f);
      const dto = await retry(f, p); assert.equal(dto.referencia_local, f.local.referencia_local);
      assert.equal((await checkout(f.local.id_checkout)).estado, "PENDIENTE"); assert.equal(posts(p).length, 0); await unchanged(f);
    });
    test("saldo Q0 durante GET expired no reserva sucesor ni aplica otro abono", async () => {
      const f = await fixture(), p = provider(f, { status: "expired", getHook: async () => {
        await query("INSERT INTO PAGO(id_cuota,monto_pagado,fecha_pago) VALUES(?,115,'2024-01-01')", [f.id]);
      } });
      await code(retry(f, p), "QUOTA_PAID"); assert.equal(posts(p).length, 0);
      assert.equal((await checkout(f.local.id_checkout)).estado, "EXPIRADO"); assert.equal(Number((await balance(f.id)).saldo_pendiente), 0);
      assert.equal((await query("SELECT COUNT(*) n FROM CHECKOUT_RECURRENTE WHERE id_cuota=?", [f.id]))[0].n, 1);
    });
    test("INCIERTO bloquea aunque exista intento fallido; no se consulta ni crea checkout", async () => {
      const f = await fixture({ state: "INCIERTO" }); await deliver(f.payload); const p = provider(f);
      await code(retry(f, p), "CHECKOUT_UNCERTAIN"); assert.equal(p.calls.length, 0); await unchanged(f);
    });
    for (const mode of ["timeout", "500", "invalid"]) test(`GET ${mode} conserva INCIERTO sin recuperación por tiempo`, async () => {
      const f = await fixture(), p = provider(f, { mode }); await assert.rejects(retry(f, p));
      assert.equal((await checkout(f.local.id_checkout)).estado, "INCIERTO");
      p.state.mode = "ok"; await code(retry(f, p), "CHECKOUT_UNCERTAIN"); assert.equal(posts(p).length, 0); await unchanged(f);
    });
    test("otro Sandbox en GET/test impide consulta de checkout y creación", async () => {
      const f = await fixture(), p = provider(f, { status: "expired" }); p.state.sandboxId = "sbx_OTHER";
      await code(retry(f, p), "CHECKOUT_SANDBOX_MISMATCH"); assert.equal(p.calls.length, 1); assert.equal((await checkout(f.local.id_checkout)).estado, "INCIERTO"); await unchanged(f);
    });
    test("saldo Q0 bloquea retry sin llamadas aun con checkout expired", async () => {
      const f = await fixture(); await deliver(paymentPayload(f.local)); const p = provider(f, { status: "expired" });
      await code(retry(f, p), "CHECKOUT_NOT_USABLE"); await code(p.service.startResidentCheckout(3, f.id), "QUOTA_PAID"); assert.equal(p.calls.length, 0);
    });
    test("sobrepago histórico detectado y bloqueado antes de GET o POST", async () => {
      const f = await fixture(); await query("INSERT INTO PAGO(id_cuota,monto_pagado,fecha_pago) VALUES(?,120,'2024-01-01')", [f.id]);
      const p = provider(f, { status: "expired" }); await code(retry(f, p), "FINANCIAL_OVERPAYMENT"); assert.equal(p.calls.length, 0);
    });
    test("saldo menor de Q5 no se aumenta ni se cobra", async () => {
      const f = await fixture(); await query("INSERT INTO PAGO(id_cuota,monto_pagado,fecha_pago) VALUES(?,111,'2024-01-01')", [f.id]);
      const p = provider(f, { status: "expired" }); await code(retry(f, p), "CHECKOUT_MINIMUM"); assert.equal(p.calls.length, 0);
    });
    test("fallo no habilita pago simulado mientras siga el checkout activo", async () => {
      const f = await fixture(); await deliver(f.payload);
      await code(payObligation(3, "residente", f.id), "CHECKOUT_SIMULATION_BLOCKED"); await unchanged(f);
    });
    test("referencia ajena no autoriza retry ni lectura del estado", async () => {
      const f = await fixture(), p = provider(f);
      await code(p.service.retryResidentCheckout(4, f.local.referencia_local), "CHECKOUT_NOT_FOUND");
      await code(p.service.residentCheckoutStatus(4, f.local.referencia_local), "CHECKOUT_NOT_FOUND"); assert.equal(p.calls.length, 0);
    });
    test("consulta de estado es lectura local y no retorna datos sensibles o identificadores externos", async () => {
      const f = await fixture(); await deliver(f.payload); const p = provider(f);
      const dto = await p.service.residentCheckoutStatus(3, f.local.referencia_local);
      assert.equal(dto.estado, "RECHAZADO"); assert.equal(dto.accion, "CONTINUAR"); assert.equal(p.calls.length, 0);
      assert.deepEqual(Object.keys(dto).sort(), ["accion", "estado", "mensaje", "referencia_local"]); await unchanged(f);
    });
    test("estado de checkout anterior expired no ofrece retry cuando ya existe sucesor activo", async () => {
      const f = await fixture(), p = provider(f, { status: "expired" }); await retry(f, p);
      const before = p.calls.length, dto = await p.service.residentCheckoutStatus(3, f.local.referencia_local);
      assert.equal(dto.accion, "NINGUNA"); assert.equal(dto.estado, "PENDIENTE"); assert.equal(p.calls.length, before); await unchanged(f);
    });
    test("estado backend no ofrece retry si el saldo autorizado actual es menor al mínimo", async () => {
      const f = await fixture(), p = provider(f); await query("INSERT INTO PAGO(id_cuota,monto_pagado,fecha_pago) VALUES(?,111,'2024-01-01')", [f.id]);
      const dto = await p.service.residentCheckoutStatus(3, f.local.referencia_local);
      assert.equal(dto.accion, "NINGUNA"); assert.equal(dto.estado, "NO_COMPLETADO"); assert.equal(p.calls.length, 0);
    });
    test("004 FK y CHECK impiden evento huérfano y aplicación financiera en fallo", async () => {
      const f = await fixture(); await deliver(f.payload); const [e] = await events(f.local.id_checkout), [t] = await transactions(f.id);
      await assert.rejects(query("UPDATE EVENTO_RECURRENTE SET id_checkout=999999999 WHERE id_evento=?", [e.id_evento]), { code: "ER_NO_REFERENCED_ROW_2" });
      await assert.rejects(query("UPDATE EVENTO_RECURRENTE SET resultado_intento='CONFIRMADA' WHERE id_evento=?", [e.id_evento]), { code: "ER_CHECK_CONSTRAINT_VIOLATED" });
      await assert.rejects(query("UPDATE TRANSACCION_RECURRENTE SET capital_aplicado_centavos=10000,recargo_aplicado_centavos=1500 WHERE id_transaccion=?", [t.id_transaccion]), { code: "ER_CHECK_CONSTRAINT_VIOLATED" });
      await unchanged(f);
    });
    test("HTTP funcional: rechazo firmado, duplicate, estado backend y continuación misma operación", async () => {
      const f = await fixture(), p = provider(f); await withHttp(p, async (base, token) => {
        const body = signed(f.payload); const post = () => fetch(`${base}/webhooks/recurrente`, { method: "POST", headers: { "Content-Type": "application/json", ...body.headers }, body: body.raw });
        const first = await post(); assert.equal(first.status, 200); assert.equal((await first.json()).result, "processed");
        const duplicate = await post(); assert.equal(duplicate.status, 200); assert.equal((await duplicate.json()).result, "duplicate");
        const status = await fetch(`${base}/residente/pagos/recurrente/checkouts/${f.local.referencia_local}`, { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(status.status, 200); assert.equal(status.headers.get("cache-control"), "no-store"); assert.equal((await status.json()).estado, "RECHAZADO");
        const response = await fetch(`${base}/residente/pagos/recurrente/reintentar`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ referencia_local: f.local.referencia_local }) });
        assert.equal(response.status, 201); assert.equal((await response.json()).referencia_local, f.local.referencia_local); assert.equal(posts(p).length, 0); await unchanged(f);
      });
    });
    test("HTTP funcional: firma inválida rechazada antes de inbox/DB", async () => {
      const f = await fixture(), p = provider(f); await withHttp(p, async (base) => {
        const body = signed(f.payload); const r = await fetch(`${base}/webhooks/recurrente`, { method: "POST", headers: { "Content-Type": "application/json", ...body.headers, "svix-signature": "v1,invalid" }, body: body.raw });
        assert.equal(r.status, 401); assert.equal((await r.json()).code, "WEBHOOK_INVALID_SIGNATURE");
        assert.equal((await query("SELECT COUNT(*) n FROM EVENTO_RECURRENTE WHERE svix_id=?", [body.svixId]))[0].n, 0); await unchanged(f);
      });
    });
    test("HTTP funcional: Sandbox ajeno y evento desconocido no afectan saldo", async () => {
      const f = await fixture(), p = provider(f); await withHttp(p, async (base) => {
        for (const changes of [{ sandbox_id: "sbx_OTHER" }, { event_type: "unknown.failed" }]) {
          const body = signed({ ...f.payload, ...changes }); const r = await fetch(`${base}/webhooks/recurrente`, { method: "POST", headers: { "Content-Type": "application/json", ...body.headers }, body: body.raw });
          assert.equal(r.status, 200); assert.equal((await r.json()).result, "ignored");
        }
        assert.equal((await transactions(f.id)).length, 0); await unchanged(f);
      });
    });
    test("HTTP funcional: rollback de intento devuelve 503 y reentrega TEST confirma solo el fallo", async () => {
      const f = await fixture(), p = provider(f), target = createWebhookService({ pool: failingPool(/^INSERT INTO TRANSACCION_RECURRENTE/) });
      await withHttp(p, async (base) => {
        const body = signed(f.payload); const post = () => fetch(`${base}/webhooks/recurrente`, { method: "POST", headers: { "Content-Type": "application/json", ...body.headers }, body: body.raw });
        assert.equal((await post()).status, 503); assert.equal((await transactions(f.id)).length, 0); await unchanged(f);
        const retry = await post(); assert.equal(retry.status, 200); assert.equal((await retry.json()).result, "processed");
        assert.equal((await transactions(f.id)).length, 1); await unchanged(f);
      }, target);
    });
    test("HTTP funcional: expired y retry concurrente no generan dos operaciones", async () => {
      const f = await fixture(), p = provider(f, { status: "expired", postHook: async () => new Promise((r) => setTimeout(r, 80)) });
      await withHttp(p, async (base, token) => {
        const post = () => fetch(`${base}/residente/pagos/recurrente/reintentar`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ referencia_local: f.local.referencia_local }) });
        const responses = await Promise.all([post(), post()]); assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
        assert.equal(posts(p).length, 1); assert.equal((await query("SELECT COUNT(*) n FROM CHECKOUT_RECURRENTE WHERE id_cuota=?", [f.id]))[0].n, 2); await unchanged(f);
      });
    });
  });
}
