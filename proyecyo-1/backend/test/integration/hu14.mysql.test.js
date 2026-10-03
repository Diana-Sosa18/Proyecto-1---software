const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const { configureTestEnvironment, connect } = require("./support/isolatedMysql");

if (process.env.RUN_PHASE0_MYSQL_TESTS !== "1") {
  test("HU14 necesita MySQL exclusivamente aislado", { skip: true }, () => {});
} else {
  require("./support/suiteIsolation").assertOwnedSuiteDatabase();
  configureTestEnvironment();
  const db = require("../../src/database/mysql");
  const migrations = require("../../src/database/recurrenteMigration");
  const { createWebhookService } = require("../../src/services/recurrenteWebhookService");
  const { createWebhookHandler } = require("../../src/controllers/recurrenteWebhookController");
  const { verifyWebhook, inspectEvent } = require("../../src/services/recurrenteWebhookPayload");
  const { configuration, paymentPayload, observedPaymentPair, signed, TEST_SANDBOX } = require("./support/recurrenteWebhookFixtures");
  const { QUOTA_BALANCES_SQL } = require("../../src/services/financialBalance");
  const { applyPartialFixture } = require("./support/financialFixtures");
  let connection;
  const query = async (sql, params = []) => (await connection.query(sql, params))[0];
  const balance = async (id) => (await query(`SELECT * FROM (${QUOTA_BALANCES_SQL}) b WHERE id_cuota=?`, [id]))[0];
  const service = createWebhookService();
  async function fixture({ amount = 11500, principal = "100.00", surcharge = "15.00", state = "PENDIENTE", house = 1 } = {}) {
    const id = (await query("INSERT INTO CUOTA(id_servicio,id_casa,monto,fecha_limite) VALUES(1,?,?,'2025-01-10')", [house, principal])).insertId;
    if (Number(surcharge)) await query("INSERT INTO RECARGO_APLICADO(id_cuota,id_casa,tipo_regla,monto_original,monto_recargo,fecha_aplicacion) VALUES(?,?,'FIJO',?,?,'2025-01-15')", [id, house, principal, surcharge]);
    const [owner] = await query("SELECT ca.id_residente,r.id_usuario FROM CASA ca JOIN RESIDENTE r ON r.id_residente=ca.id_residente WHERE ca.id_casa=?", [house]);
    const local = { referencia_local: randomUUID(), id_externo: `ch_TEST_${randomUUID().replaceAll("-", "")}`,
      idempotency_key: randomUUID(), id_cuota: id, id_usuario: owner.id_usuario, id_residente: owner.id_residente, id_casa: house,
      monto_centavos: amount, capital_centavos: Math.max(0, amount - Math.min(amount, Number(surcharge) * 100)),
      recargo_centavos: Math.min(amount, Number(surcharge) * 100), moneda: "GTQ", ambiente: "sandbox", sandbox_id: TEST_SANDBOX,
      estado: state, estado_proveedor: "unpaid" };
    local.id_checkout = (await query("INSERT INTO CHECKOUT_RECURRENTE SET ?", local)).insertId;
    return { id, local, payload: paymentPayload(local) };
  }
  function input(payload, options) {
    const f = signed(payload, options), verified = verifyWebhook(f.raw, f.headers, configuration());
    return { ...verified, payload: undefined, event: inspectEvent(verified.payload, TEST_SANDBOX), sandboxId: TEST_SANDBOX };
  }
  const deliver = (payload, options, target = service) => target.receive(input(payload, options));
  const eventRow = async (svixId) => (await query("SELECT * FROM EVENTO_RECURRENTE WHERE ambiente='sandbox' AND svix_id=?", [svixId]))[0];
  async function noPayment(id) {
    assert.equal((await query("SELECT COUNT(*) n FROM PAGO WHERE id_cuota=?", [id]))[0].n, 0);
    assert.equal((await query("SELECT COUNT(*) n FROM TRANSACCION_RECURRENTE WHERE id_cuota=?", [id]))[0].n, 0);
    assert.equal((await query("SELECT COUNT(*) n FROM PAGO_ORIGEN WHERE id_cuota=?", [id]))[0].n, 0);
  }
  async function onePayment(id) {
    assert.equal((await query("SELECT COUNT(*) n FROM PAGO WHERE id_cuota=?", [id]))[0].n, 1);
    assert.equal((await query("SELECT COUNT(*) n FROM TRANSACCION_RECURRENTE WHERE id_cuota=? AND estado='CONFIRMADA'", [id]))[0].n, 1);
    assert.equal((await query("SELECT COUNT(*) n FROM PAGO_ORIGEN WHERE id_cuota=? AND origen='RECURRENTE' AND ambiente='sandbox'", [id]))[0].n, 1);
  }
  function failingPool(pattern) {
    let triggered = false;
    return { getConnection: async () => {
      const c = await db.pool.getConnection(), execute = c.execute.bind(c), release = c.release.bind(c);
      c.execute = (sql, params) => {
        if (!triggered && pattern.test(sql)) { triggered = true; return execute("SELECT missing_hu14_test_column FROM CUOTA LIMIT 1"); }
        return execute(sql, params);
      };
      c.release = () => { c.execute = execute; c.release = release; release(); };
      return c;
    } };
  }
  describe("HU14 MySQL real aislado y firmas Svix TEST", { concurrency: false }, () => {
    before(async () => {
      await require("./support/initializeTestSchema").initializeTestSchema();
      connection = await connect();
      for (const [name, ensure] of Object.entries(db)) if (name.startsWith("ensure")) await ensure();
      await migrations.applyRecurrentePreparation(connection); await migrations.applyRecurrenteCheckoutMigration(connection);
      await migrations.applyRecurrenteConfirmationMigration(connection); await migrations.applyRecurrenteAttemptsMigration(connection);
    });
    after(async () => { await connection?.end(); await db.pool.end(); });
    test("003 aditiva repetible preserva todas las filas y montos", async () => {
      const tables = ["PAGO", "PAGO_ORIGEN", "CHECKOUT_RECURRENTE", "TRANSACCION_RECURRENTE", "EVENTO_RECURRENTE", "REEMBOLSO_RECURRENTE"];
      const beforeRows = await Promise.all(tables.map((t) => query(`SELECT * FROM ${t} ORDER BY 1`)));
      await migrations.applyRecurrenteConfirmationMigration(connection); await migrations.applyRecurrenteConfirmationMigration(connection);
      for (let i = 0; i < tables.length; i++) assert.deepEqual(await query(`SELECT * FROM ${tables[i]} ORDER BY 1`), beforeRows[i]);
      assert.doesNotMatch(fs.readFileSync(migrations.CONFIRMATION_MIGRATION_PATH, "utf8"), /\bDROP\s+(TABLE|COLUMN|DATABASE)\b|\bDELETE\s+FROM|\bTRUNCATE\b/i);
      const [column] = await query("SELECT DATETIME_PRECISION precision_value FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='TRANSACCION_RECURRENTE' AND COLUMN_NAME='fecha_proveedor_utc'");
      assert.equal(column.precision_value, 6);
    });
    test("pago completo atomico: transaccion, PAGO, origen, checkout, inbox y fecha Guatemala", async () => {
      const f = await fixture(), svixId = `msg_TEST_${randomUUID()}`;
      assert.equal(await deliver(f.payload, { svixId }), "processed"); await onePayment(f.id);
      const [tx] = await query("SELECT * FROM TRANSACCION_RECURRENTE WHERE id_cuota=?", [f.id]);
      const [p] = await query("SELECT * FROM PAGO WHERE id_cuota=?", [f.id]);
      assert.equal(p.monto_pagado, "115.00"); assert.equal(p.fecha_pago, "2026-07-31");
      assert.equal(tx.id_pago, p.id_pago); assert.equal(tx.id_externo, f.payload.id); assert.equal(tx.id_pago_externo, f.payload.payment.id);
      assert.equal(tx.fecha_proveedor_original, f.payload.created_at); assert.equal(tx.fecha_proveedor_utc, "2026-08-01 02:30:00.123456");
      assert.equal(tx.capital_aplicado_centavos, 10000); assert.equal(tx.recargo_aplicado_centavos, 1500);
      assert(tx.confirmado_en); assert.equal(tx.id_evento, (await eventRow(svixId)).id_evento);
      const [co] = await query("SELECT estado,estado_proveedor FROM CHECKOUT_RECURRENTE WHERE id_checkout=?", [f.local.id_checkout]);
      assert.deepEqual(co, { estado: "CONFIRMADO", estado_proveedor: "paid" });
      const row = await balance(f.id); assert.equal(Number(row.saldo_pendiente), 0); assert.equal(Number(row.sobrepago), 0);
      assert.equal((await eventRow(svixId)).estado, "PROCESADO"); assert((await eventRow(svixId)).recibido_en);
    });
    for (const [amount, capital, surcharge, pending] of [[1000, 100, 5, 105], [5000, 65, 0, 65], [11500, 0, 0, 0]]) {
      test(`abono Q${amount / 100}: recargos primero, capital Q${capital}, recargos Q${surcharge}, saldo Q${pending}`, async () => {
        const f = await fixture({ amount }); await deliver(f.payload); const row = await balance(f.id);
        assert.equal(Number(row.capital_pendiente), capital); assert.equal(Number(row.recargo_pendiente), surcharge); assert.equal(Number(row.saldo_pendiente), pending);
        const [tx] = await query("SELECT capital_aplicado_centavos,recargo_aplicado_centavos FROM TRANSACCION_RECURRENTE WHERE id_cuota=?", [f.id]);
        assert.equal(tx.recargo_aplicado_centavos, Math.min(1500, amount)); assert.equal(tx.capital_aplicado_centavos, Math.max(0, amount - 1500));
      });
    }
    test("Q10.01 se registra como DECIMAL exacto y centavos enteros", async () => {
      const f = await fixture({ amount: 1001, principal: "10.01", surcharge: "0" }); await deliver(f.payload);
      assert.equal((await query("SELECT monto_pagado FROM PAGO WHERE id_cuota=?", [f.id]))[0].monto_pagado, "10.01");
      assert.equal(Number((await balance(f.id)).saldo_pendiente), 0);
    });
    test("replay del mismo svix-id conserva fecha y exactamente un PAGO", async () => {
      const f = await fixture(), svixId = `msg_TEST_${randomUUID()}`;
      await deliver(f.payload, { svixId }); const [beforeRow] = await query("SELECT * FROM PAGO WHERE id_cuota=?", [f.id]);
      assert.equal(await deliver(f.payload, { svixId }), "duplicate"); await onePayment(f.id);
      assert.deepEqual((await query("SELECT * FROM PAGO WHERE id_cuota=?", [f.id]))[0], beforeRow);
    });
    test("mismo svix-id concurrente aplica exactamente una vez", async () => {
      const f = await fixture(), svixId = `msg_TEST_${randomUUID()}`;
      const results = await Promise.all([deliver(f.payload, { svixId }), deliver(f.payload, { svixId })]);
      assert.deepEqual(results.sort(), ["duplicate", "processed"]); await onePayment(f.id);
    });
    test("dos eventos concurrentes de la misma transaccion aplican un solo PAGO", async () => {
      const f = await fixture(); const results = await Promise.all([deliver(f.payload), deliver(f.payload)]);
      assert.deepEqual(results.sort(), ["duplicate", "processed"]); await onePayment(f.id);
    });
    test("transaccion externa ya confirmada con svix-id distinto es duplicado", async () => {
      const f = await fixture(); await deliver(f.payload); assert.equal(await deliver(f.payload), "duplicate"); await onePayment(f.id);
    });
    test("transaccion local pendiente se confirma atomicamente sin crear otra", async () => {
      const f = await fixture();
      const existing = (await query("INSERT INTO TRANSACCION_RECURRENTE SET ?", {
        id_checkout: f.local.id_checkout, id_externo: f.payload.id, idempotency_key: randomUUID(),
        id_cuota: f.id, id_usuario: 3, id_casa: 1, monto_centavos: 11500, moneda: "GTQ", ambiente: "sandbox", estado: "PENDIENTE",
      })).insertId;
      assert.equal(await deliver(f.payload), "processed"); await onePayment(f.id);
      assert.equal((await query("SELECT id_transaccion FROM TRANSACCION_RECURRENTE WHERE id_cuota=?", [f.id]))[0].id_transaccion, existing);
    });
    test("confirmacion preexistente sin PAGO requiere revision y no inventa reparacion", async () => {
      const f = await fixture();
      await query("INSERT INTO TRANSACCION_RECURRENTE SET ?", { id_checkout: f.local.id_checkout,
        id_externo: f.payload.id, idempotency_key: randomUUID(), id_cuota: f.id, id_usuario: 3, id_casa: 1,
        monto_centavos: 11500, moneda: "GTQ", ambiente: "sandbox", estado: "CONFIRMADA" });
      assert.equal(await deliver(f.payload), "review");
      assert.equal((await query("SELECT COUNT(*) n FROM PAGO WHERE id_cuota=?", [f.id]))[0].n, 0);
    });
    test("svix-id con bytes distintos rechaza conflicto y no cambia asiento", async () => {
      const f = await fixture(), svixId = `msg_TEST_${randomUUID()}`; await deliver(f.payload, { svixId });
      await assert.rejects(deliver({ ...f.payload, amount_in_cents: 1000 }, { svixId }), { code: "WEBHOOK_EVENT_CONFLICT" });
      await onePayment(f.id);
    });
    test("segunda transaccion diferente para checkout confirmado queda en revision", async () => {
      const f = await fixture(); await deliver(f.payload);
      assert.equal(await deliver(paymentPayload(f.local)), "review"); await onePayment(f.id);
    });
    test("mismo payment externo con intent diferente no duplica", async () => {
      const f = await fixture(); await deliver(f.payload);
      assert.equal(await deliver({ ...f.payload, id: `in_TEST_${randomUUID()}` }), "review"); await onePayment(f.id);
    });
    test("intent de otra obligacion no se reasocia", async () => {
      const a = await fixture(), b = await fixture(); await deliver(a.payload);
      assert.equal(await deliver({ ...b.payload, id: a.payload.id, payment: a.payload.payment }), "review");
      await onePayment(a.id); await noPayment(b.id);
    });
    test("intent identico concurrente en dos obligaciones: UNIQUE revierte perdedor y replay va a revision", async () => {
      const a = await fixture(), b = await fixture();
      const payloadB = { ...b.payload, id: a.payload.id, payment: a.payload.payment };
      const idA = `msg_TEST_${randomUUID()}`, idB = `msg_TEST_${randomUUID()}`;
      const results = await Promise.allSettled([deliver(a.payload, { svixId: idA }), deliver(payloadB, { svixId: idB })]);
      assert.equal(results.filter((r) => r.status === "fulfilled" && r.value === "processed").length, 1);
      const loser = results[0].status === "fulfilled" && results[0].value === "processed" ? 1 : 0;
      assert.equal(await deliver(loser ? payloadB : a.payload, { svixId: loser ? idB : idA }), "review");
      assert.equal((await query("SELECT COUNT(*) n FROM PAGO WHERE id_cuota IN (?,?)", [a.id, b.id]))[0].n, 1);
    });
    test("timestamp distinto en nuevo evento nunca reescribe fecha contable existente", async () => {
      const f = await fixture(); await deliver(f.payload);
      assert.equal(await deliver({ ...f.payload, created_at: "2026-09-01T12:00:00Z" }), "review");
      assert.equal((await query("SELECT fecha_pago FROM PAGO WHERE id_cuota=?", [f.id]))[0].fecha_pago, "2026-07-31"); await onePayment(f.id);
    });
    for (const [name, changes] of [
      ["sandbox ajeno", { sandbox_id: "sbx_foreign" }], ["produccion", { live_mode: true }],
      ["sin live_mode", { live_mode: undefined }], ["sin sandbox_id", { sandbox_id: undefined }],
      ["reembolso", { event_type: "refund.create" }],
      ["suscripcion", { event_type: "subscription.create" }], ["otro metodo", { type: "bank_transfer" }],
    ]) {
      test(`${name}: inbox ignorado sin transaccion ni PAGO`, async () => {
        const f = await fixture(); assert.equal(await deliver({ ...f.payload, ...changes }), "ignored"); await noPayment(f.id);
      });
    }
    test("payment_intent incompleto despues del unificado requiere revision sin otro PAGO", async () => {
      const f = await fixture(); await deliver(f.payload);
      assert.equal(await deliver({ ...f.payload, event_type: "payment_intent.succeeded" }), "review"); await onePayment(f.id);
    });
    for (const [name, changes, expected] of [
      ["monto", { amount_in_cents: 11499 }, "WEBHOOK_AMOUNT_MISMATCH"],
      ["moneda", { currency: "USD" }, "WEBHOOK_CURRENCY_MISMATCH"],
      ["fecha ausente", { created_at: undefined }, "WEBHOOK_PAYMENT_DATE_UNTRUSTED"],
      ["fecha invalida", { created_at: "2026-02-30T00:00:00Z" }, "WEBHOOK_PAYMENT_DATE_UNTRUSTED"],
    ]) {
      test(`${name} incompatible: revision persistida y replay seguro sin asiento`, async () => {
        const f = await fixture(), svixId = `msg_TEST_${randomUUID()}`, payload = { ...f.payload, ...changes };
        assert.equal(await deliver(payload, { svixId }), "review"); assert.equal((await eventRow(svixId)).error_codigo, expected);
        assert.equal(await deliver(payload, { svixId }), "review"); await noPayment(f.id);
      });
    }
    test("metadata de otra cuota no suplanta asociacion local", async () => {
      const a = await fixture(), b = await fixture();
      assert.equal(await deliver({ ...a.payload, checkout: { ...a.payload.checkout, metadata: { nexus_checkout_reference: b.local.referencia_local } } }), "review");
      await noPayment(a.id); await noPayment(b.id);
    });
    test("asociacion residente local incoherente se rechaza", async () => {
      const f = await fixture(); await query("UPDATE CHECKOUT_RECURRENTE SET id_usuario=4 WHERE id_checkout=?", [f.local.id_checkout]);
      assert.equal(await deliver(f.payload), "review"); await noPayment(f.id);
    });
    test("checkout inexistente: 503, inbox reintentable, no aplicacion", async () => {
      const f = await fixture(), svixId = `msg_TEST_${randomUUID()}`;
      await assert.rejects(deliver({ ...f.payload, checkout: { id: "ch_TEST_missing" } }, { svixId }), { code: "WEBHOOK_CHECKOUT_NOT_READY" });
      assert.equal((await eventRow(svixId)).estado, "FALLIDO"); await noPayment(f.id);
    });
    test("evento adelanta persistencia HU13: reintento tras guardar ID aplica una vez", async () => {
      const f = await fixture(), svixId = `msg_TEST_${randomUUID()}`;
      await query("UPDATE CHECKOUT_RECURRENTE SET id_externo=NULL,estado='INCIERTO' WHERE id_checkout=?", [f.local.id_checkout]);
      await assert.rejects(deliver(f.payload, { svixId }), { status: 503 }); await noPayment(f.id);
      await query("UPDATE CHECKOUT_RECURRENTE SET id_externo=? WHERE id_checkout=?", [f.local.id_externo, f.local.id_checkout]);
      assert.equal(await deliver(f.payload, { svixId }), "processed"); await onePayment(f.id);
    });
    test("sobrepago historico no crea asiento ni saldo negativo", async () => {
      const f = await fixture(); await query("INSERT INTO PAGO(id_cuota,monto_pagado,fecha_pago) VALUES(?,120,'2025-02-01')", [f.id]);
      assert.equal(await deliver(f.payload), "review");
      assert.equal((await query("SELECT COUNT(*) n FROM PAGO WHERE id_cuota=?", [f.id]))[0].n, 1);
      const b = await balance(f.id); assert.equal(Number(b.saldo_pendiente), 0); assert.equal(Number(b.sobrepago), 5);
    });
    test("saldo cambio: cobro excedente queda en revision sin nuevo PAGO", async () => {
      const f = await fixture(); await applyPartialFixture(f.id, 10);
      assert.equal(await deliver(f.payload), "review"); assert.equal(Number((await balance(f.id)).saldo_pendiente), 105);
      assert.equal((await query("SELECT COUNT(*) n FROM PAGO WHERE id_cuota=?", [f.id]))[0].n, 1);
    });
    test("abonos concurrentes sobre misma cuota respetan recargos primero", async () => {
      const f = await fixture({ amount: 5000 }); const results = await Promise.all([deliver(f.payload), applyPartialFixture(f.id, 10)]);
      assert.equal(results[0], "processed"); const b = await balance(f.id);
      assert.equal(Number(b.total_pagado), 60); assert.equal(Number(b.recargo_pendiente), 0); assert.equal(Number(b.capital_pendiente), 55);
    });
    test("abonos concurrentes que exceden saldo: una sola aplicacion sin negativos", async () => {
      const f = await fixture({ amount: 8000 });
      const results = await Promise.allSettled([deliver(f.payload), applyPartialFixture(f.id, 80)]);
      const b = await balance(f.id); assert.equal(Number(b.total_pagado), 80); assert.equal(Number(b.saldo_pendiente), 35); assert.equal(Number(b.sobrepago), 0);
      assert.equal(results.filter((r) => r.status === "rejected" || r.value === "review").length, 1);
    });
    for (const [name, pattern] of [["INSERT PAGO", /^INSERT INTO PAGO\(/], ["INSERT origen", /^INSERT INTO PAGO_ORIGEN/],
      ["INSERT transaccion", /^INSERT INTO TRANSACCION_RECURRENTE/], ["UPDATE checkout", /^UPDATE CHECKOUT_RECURRENTE/],
      ["UPDATE inbox final", /^UPDATE EVENTO_RECURRENTE SET estado=\?,/]]) {
      test(`fallo SQL en ${name}: rollback completo y posterior replay recupera una vez`, async () => {
        const f = await fixture(), svixId = `msg_TEST_${randomUUID()}`, failed = createWebhookService({ pool: failingPool(pattern) });
        await assert.rejects(deliver(f.payload, { svixId }, failed), { code: "WEBHOOK_RETRY", status: 503 });
        await noPayment(f.id); assert.equal(Number((await balance(f.id)).saldo_pendiente), 115);
        assert.equal((await query("SELECT estado FROM CHECKOUT_RECURRENTE WHERE id_checkout=?", [f.local.id_checkout]))[0].estado, "PENDIENTE");
        const row = await eventRow(svixId); assert.equal(row.estado, "FALLIDO"); assert.equal(row.procesado_en, null);
        assert.equal(row.error_codigo, "WEBHOOK_RETRY"); assert.equal(row.error_sanitizado, null);
        assert.equal(await deliver(f.payload, { svixId }), "processed"); assert.equal(await deliver(f.payload, { svixId }), "duplicate"); await onePayment(f.id);
      });
    }
    test("restricciones nuevas: payment externo UNIQUE, evento FK/ambiente, suma de aplicacion CHECK", async () => {
      const a = await fixture(), b = await fixture(); await deliver(a.payload);
      const [tx] = await query("SELECT * FROM TRANSACCION_RECURRENTE WHERE id_cuota=?", [a.id]);
      const basic = { id_checkout: b.local.id_checkout, id_externo: `in_TEST_${randomUUID()}`, idempotency_key: randomUUID(),
        id_cuota: b.id, id_usuario: 3, id_casa: 1, monto_centavos: 11500, moneda: "GTQ", ambiente: "sandbox" };
      await assert.rejects(query("INSERT INTO TRANSACCION_RECURRENTE SET ?", { ...basic, id_pago_externo: tx.id_pago_externo }), { code: "ER_DUP_ENTRY" });
      await assert.rejects(query("INSERT INTO TRANSACCION_RECURRENTE SET ?", { ...basic, id_evento: 999999999 }), { code: "ER_NO_REFERENCED_ROW_2" });
      const event = (await query("INSERT INTO EVENTO_RECURRENTE(svix_id,ambiente,tipo_evento,hash_body) VALUES(?,'production','test',?)", [`msg_TEST_${randomUUID()}`, "a".repeat(64)])).insertId;
      await assert.rejects(query("INSERT INTO TRANSACCION_RECURRENTE SET ?", { ...basic, id_evento: event }), { code: "ER_NO_REFERENCED_ROW_2" });
      await assert.rejects(query("INSERT INTO TRANSACCION_RECURRENTE SET ?", { ...basic, capital_aplicado_centavos: 1, recargo_aplicado_centavos: 1 }), { code: "ER_CHECK_CONSTRAINT_VIOLATED" });
    });
    test("respuesta SQL perdida tras COMMIT: HTTP reintentable y replay sin doble asiento", async () => {
      const f = await fixture(), svixId = `msg_TEST_${randomUUID()}`;
      let lost = false;
      const pool = { getConnection: async () => {
        const c = await db.pool.getConnection(), commit = c.commit.bind(c), release = c.release.bind(c);
        c.commit = async () => { await commit(); if (!lost) { lost = true; throw new Error("TEST lost COMMIT acknowledgement"); } };
        c.release = () => { c.commit = commit; c.release = release; release(); }; return c;
      } };
      await assert.rejects(deliver(f.payload, { svixId }, createWebhookService({ pool })), { code: "WEBHOOK_RETRY" });
      assert.equal((await eventRow(svixId)).estado, "PROCESADO"); await onePayment(f.id);
      assert.equal(await deliver(f.payload, { svixId }), "duplicate"); await onePayment(f.id);
    });
    test("reporte por periodo usa fecha Recurrente; saldo usa todos los pagos", async () => {
      const f = await fixture(); await deliver(f.payload);
      const detail = await require("../../src/services/residentFinancialDetailService").getFinancialDetail(3, { desde: "2026-08-01", hasta: "2026-08-31" });
      assert.equal(detail.cargos.find((q) => q.id_cuota === f.id).saldo, 0);
      assert.equal(detail.pagos.filter((p) => p.id_cuota === f.id).length, 0);
      const july = await require("../../src/services/residentFinancialDetailService").getFinancialDetail(3, { desde: "2026-07-01", hasta: "2026-07-31" });
      assert.equal(july.pagos.filter((p) => p.id_cuota === f.id).length, 1);
      const account = await require("../../src/services/residentAccountService").listResidentAccountStatement(3);
      assert.equal(account.cuotas.find((q) => q.id_cuota === f.id).saldo_pendiente, 0);
    });
    test("datos sensibles del payload no quedan persistidos", async () => {
      const f = await fixture(); const svixId = `msg_TEST_${randomUUID()}`;
      await deliver({ ...f.payload, customer: { email: "SENSITIVE_TEST_EMAIL" }, details: { card: "SENSITIVE_TEST_CARD", cvc: "SENSITIVE_TEST_CVC" } }, { svixId });
      const audit = JSON.stringify([await eventRow(svixId), await query("SELECT * FROM TRANSACCION_RECURRENTE WHERE id_cuota=?", [f.id])]);
      assert(!audit.includes("SENSITIVE_TEST_"));
    });
    async function observedFixture() {
      const f = await fixture({ amount: 500, principal: "5.00", surcharge: "0" });
      return { ...f, pair: observedPaymentPair(f.local) };
    }
    async function observedApplied(f) {
      await onePayment(f.id);
      const [p] = await query("SELECT monto_pagado,fecha_pago FROM PAGO WHERE id_cuota=?", [f.id]);
      assert.deepEqual(p, { monto_pagado: "5.00", fecha_pago: "2026-10-02" });
      const [tx] = await query("SELECT id_externo,id_pago_externo,fecha_proveedor_original,capital_aplicado_centavos,recargo_aplicado_centavos FROM TRANSACCION_RECURRENTE WHERE id_cuota=?", [f.id]);
      assert.equal(tx.id_externo, f.pair.intent.id); assert.equal(tx.id_pago_externo, f.pair.intent.payment.id);
      assert.equal(tx.fecha_proveedor_original, f.pair.intent.created_at);
      assert.equal(tx.capital_aplicado_centavos, 500); assert.equal(tx.recargo_aplicado_centavos, 0);
      const b = await balance(f.id); assert.equal(Number(b.saldo_pendiente), 0); assert.equal(Number(b.sobrepago), 0);
      const [co] = await query("SELECT estado,estado_proveedor FROM CHECKOUT_RECURRENTE WHERE id_checkout=?", [f.local.id_checkout]);
      assert.deepEqual(co, { estado: "CONFIRMADO", estado_proveedor: "paid" });
    }
    async function previouslyIgnored(payload, svixId, code) {
      // Simulate an earlier handler using synthetic, verified TEST deliveries.
      // Never alter the real inbox 348/349 or use quota 171 in automated tests.
      const oldInput = input(payload, { svixId });
      oldInput.event = { ...oldInput.event, disposition: "IGNORADO", code,
        liveMode: payload.event_type === "intent.succeeded" ? null : false };
      assert.equal(await service.receive(oldInput), "ignored");
      return eventRow(svixId);
    }
    for (const kind of ["paymentIntent", "intent"]) {
      test(`contrato observado ${kind} aplica Q5 exactamente una vez`, async () => {
        const f = await observedFixture(); assert.equal(await deliver(f.pair[kind]), "processed"); await observedApplied(f);
      });
      test(`contrato observado ${kind}: replay repetido del mismo svix-id no duplica`, async () => {
        const f = await observedFixture(), svixId = `msg_TEST_${randomUUID()}`;
        assert.equal(await deliver(f.pair[kind], { svixId }), "processed");
        for (let i = 0; i < 3; i++) assert.equal(await deliver(f.pair[kind], { svixId }), "duplicate");
        await observedApplied(f); assert.equal((await eventRow(svixId)).intentos, 1);
      });
    }
    for (const first of ["paymentIntent", "intent"]) {
      test(`ambos eventos, primero ${first}: una transaccion canonica y un PAGO`, async () => {
        const f = await observedFixture(), second = first === "intent" ? "paymentIntent" : "intent";
        assert.equal(await deliver(f.pair[first]), "processed"); assert.equal(await deliver(f.pair[second]), "duplicate");
        await observedApplied(f);
      });
    }
    test("ambos eventos repetidos con svix-id iguales y diferentes conservan un solo asiento", async () => {
      const f = await observedFixture(), ids = { intent: `msg_TEST_${randomUUID()}`, paymentIntent: `msg_TEST_${randomUUID()}` };
      assert.equal(await deliver(f.pair.paymentIntent, { svixId: ids.paymentIntent }), "processed");
      for (let i = 0; i < 4; i++) for (const kind of ["intent", "paymentIntent"]) {
        assert.equal(await deliver(f.pair[kind], { svixId: ids[kind] }), "duplicate");
        assert.equal(await deliver(f.pair[kind]), "duplicate");
      }
      await observedApplied(f);
    });
    test("ambos contratos concurrentes con replays: exactamente una aplicacion financiera", async () => {
      const f = await observedFixture(), ids = [0, 1].map(() => `msg_TEST_${randomUUID()}`);
      const results = await Promise.all(Array.from({ length: 8 }, (_, i) => deliver(i % 2 ? f.pair.intent : f.pair.paymentIntent, { svixId: ids[i % 2] })));
      assert.equal(results.filter((r) => r === "processed").length, 1);
      assert.equal(results.filter((r) => r === "duplicate").length, 7); await observedApplied(f);
    });
    for (const [kind, code] of [["paymentIntent", "WEBHOOK_UNSUPPORTED_EVENT"], ["intent", "WEBHOOK_ENVIRONMENT_MISMATCH"]]) {
      test(`retry firmado recupera ${kind} IGNORADO conservando id, hash y recepcion original`, async () => {
        const f = await observedFixture(), svixId = `msg_TEST_${randomUUID()}`;
        const beforeRow = await previouslyIgnored(f.pair[kind], svixId, code); await noPayment(f.id);
        assert.equal(await deliver(f.pair[kind], { svixId }), "processed");
        const afterRow = await eventRow(svixId);
        assert.equal(afterRow.id_evento, beforeRow.id_evento); assert.equal(afterRow.hash_body, beforeRow.hash_body);
        assert.equal(afterRow.recibido_en, beforeRow.recibido_en); assert.equal(afterRow.id_operacion_externa, f.pair[kind].id);
        assert.equal(afterRow.estado, "PROCESADO"); assert.equal(afterRow.intentos, 2); assert.equal(afterRow.live_mode, 0);
        assert.equal(afterRow.error_codigo, null);
        assert.equal(await deliver(f.pair[kind], { svixId }), "duplicate"); await observedApplied(f);
      });
    }
    test("ambos antiguos IGNORADO recuperados concurrentemente convergen en un PAGO", async () => {
      const f = await observedFixture(), ids = [0, 1].map(() => `msg_TEST_${randomUUID()}`);
      const old = await previouslyIgnored(f.pair.paymentIntent, ids[0], "WEBHOOK_UNSUPPORTED_EVENT");
      const oldOther = await previouslyIgnored(f.pair.intent, ids[1], "WEBHOOK_ENVIRONMENT_MISMATCH");
      const results = await Promise.all([deliver(f.pair.paymentIntent, { svixId: ids[0] }), deliver(f.pair.intent, { svixId: ids[1] })]);
      assert.deepEqual(results.sort(), ["duplicate", "processed"]); await observedApplied(f);
      for (const [id, expectedId] of [[ids[0], old.id_evento], [ids[1], oldOther.id_evento]]) {
        const row = await eventRow(id); assert.equal(row.id_evento, expectedId); assert.equal(row.estado, "PROCESADO");
      }
    });
    test("IGNORADO con ambiente realmente ajeno permanece terminal y sin asiento", async () => {
      const f = await observedFixture(), svixId = `msg_TEST_${randomUUID()}`, payload = { ...f.pair.intent, sandbox_id: "sbx_foreign" };
      assert.equal(await deliver(payload, { svixId }), "ignored"); const original = await eventRow(svixId);
      assert.equal(await deliver(payload, { svixId }), "ignored"); assert.deepEqual(await eventRow(svixId), original); await noPayment(f.id);
    });
    test("recuperacion de IGNORADO no permite cambiar el body de un svix-id", async () => {
      const f = await observedFixture(), svixId = `msg_TEST_${randomUUID()}`;
      const beforeRow = await previouslyIgnored(f.pair.intent, svixId, "WEBHOOK_ENVIRONMENT_MISMATCH");
      const changed = structuredClone(f.pair.intent); changed.amount_in_cents = 501; changed.checkout.total_in_cents = 501;
      await assert.rejects(deliver(changed, { svixId }), { code: "WEBHOOK_EVENT_CONFLICT" });
      assert.deepEqual(await eventRow(svixId), beforeRow); await noPayment(f.id);
    });
    test("REVISION no se reabre aunque el contrato ahora sea valido", async () => {
      const f = await observedFixture(), svixId = `msg_TEST_${randomUUID()}`, old = input(f.pair.intent, { svixId });
      old.event = { ...old.event, disposition: "REVISION", code: "WEBHOOK_ASSOCIATION_MISMATCH" };
      assert.equal(await service.receive(old), "review"); const beforeRow = await eventRow(svixId);
      assert.equal(await deliver(f.pair.intent, { svixId }), "review"); assert.deepEqual(await eventRow(svixId), beforeRow); await noPayment(f.id);
    });
    for (const [name, change, expected] of [
      ["sandbox incorrecto", (p) => { p.sandbox_id = "sbx_foreign"; }, "ignored"],
      ["produccion", (p) => { p.checkout.live_mode = true; }, "ignored"],
      ["live_mode contradictorio", (p) => { p.live_mode = true; }, "ignored"],
      ["monto diferente", (p) => { p.amount_in_cents = 501; p.checkout.total_in_cents = 501; }, "review"],
      ["moneda diferente", (p) => { p.currency = "USD"; p.checkout.currency = "USD"; }, "review"],
      ["metadata ajena", (p) => { p.checkout.metadata.nexus_checkout_reference = randomUUID(); }, "review"],
    ]) {
      test(`contrato observado ${name}: ningun PAGO ni transaccion`, async () => {
        const f = await observedFixture(), payload = structuredClone(f.pair.intent); change(payload);
        assert.equal(await deliver(payload), expected); await noPayment(f.id); assert.equal(Number((await balance(f.id)).saldo_pendiente), 5);
      });
    }
    test("contrato observado con checkout desconocido responde 503 sin PAGO", async () => {
      const f = await observedFixture(), payload = structuredClone(f.pair.paymentIntent); payload.checkout.id = "ch_TEST_unknown";
      await assert.rejects(deliver(payload), { code: "WEBHOOK_CHECKOUT_NOT_READY", status: 503 }); await noPayment(f.id);
    });
    test("contrato observado sobre cuota ya pagada nunca registra otro abono", async () => {
      const f = await observedFixture(); await query("INSERT INTO PAGO(id_cuota,monto_pagado,fecha_pago) VALUES(?,5,'2026-10-01')", [f.id]);
      assert.equal(await deliver(f.pair.intent), "review");
      assert.equal((await query("SELECT COUNT(*) n FROM PAGO WHERE id_cuota=?", [f.id]))[0].n, 1);
      assert.equal((await query("SELECT COUNT(*) n FROM TRANSACCION_RECURRENTE WHERE id_cuota=?", [f.id]))[0].n, 0);
      assert.equal(Number((await balance(f.id)).saldo_pendiente), 0); assert.equal(Number((await balance(f.id)).sobrepago), 0);
    });
    test("fallo SQL al recuperar un IGNORADO: rollback, FALLIDO y replay seguro", async () => {
      const f = await observedFixture(), svixId = `msg_TEST_${randomUUID()}`;
      await previouslyIgnored(f.pair.intent, svixId, "WEBHOOK_ENVIRONMENT_MISMATCH");
      const failed = createWebhookService({ pool: failingPool(/^UPDATE CHECKOUT_RECURRENTE/) });
      await assert.rejects(deliver(f.pair.intent, { svixId }, failed), { code: "WEBHOOK_RETRY", status: 503 });
      await noPayment(f.id); assert.equal(Number((await balance(f.id)).saldo_pendiente), 5);
      assert.equal((await eventRow(svixId)).estado, "FALLIDO");
      assert.equal((await query("SELECT estado FROM CHECKOUT_RECURRENTE WHERE id_checkout=?", [f.local.id_checkout]))[0].estado, "PENDIENTE");
      assert.equal(await deliver(f.pair.intent, { svixId }), "processed"); await observedApplied(f);
    });
    test("HTTP contratos observados: firma invalida no persiste; ambos firmados concurrentes aplican una vez", async () => {
      const f = await observedFixture();
      const app = require("../../src/app").createApp({ recurrenteWebhookHandler: createWebhookHandler({ configuration, service }) });
      const server = app.listen(0, "127.0.0.1"); await new Promise((resolve) => server.once("listening", resolve));
      const url = `http://127.0.0.1:${server.address().port}/webhooks/recurrente`;
      try {
        const bad = signed(f.pair.paymentIntent);
        assert.equal((await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...bad.headers, "svix-signature": "v1,invalid" }, body: bad.raw })).status, 401);
        assert.equal((await query("SELECT COUNT(*) n FROM EVENTO_RECURRENTE WHERE svix_id=?", [bad.svixId]))[0].n, 0); await noPayment(f.id);
        const bodies = [signed(f.pair.paymentIntent), signed(f.pair.intent)];
        const post = (body) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...body.headers }, body: body.raw });
        const replies = await Promise.all(bodies.map(post)); assert(replies.every((r) => r.status === 200));
        assert.deepEqual((await Promise.all(replies.map((r) => r.json()))).map((r) => r.result).sort(), ["duplicate", "processed"]);
        for (const body of bodies) { const response = await post(body); assert.equal(response.status, 200); assert.equal((await response.json()).result, "duplicate"); }
        await observedApplied(f);
      } finally { await new Promise((resolve) => server.close(resolve)); }
    });
    test("HTTP funcional real: firma, inbox, concurrencia, PAGO, replay y saldo backend", async () => {
      const f = await fixture(); let providerCalls = 0;
      const client = { sandboxId: () => TEST_SANDBOX, createCheckout: async () => { providerCalls++; throw new Error("TEST outbound forbidden"); } };
      const checkoutService = require("../../src/services/recurrenteCheckoutService").createCheckoutService({ client });
      const app = require("../../src/app").createApp({ recurrenteWebhookHandler: createWebhookHandler({ configuration, service }), recurrenteCheckoutService: checkoutService });
      const server = app.listen(0, "127.0.0.1"); await new Promise((resolve) => server.once("listening", resolve));
      const base = `http://127.0.0.1:${server.address().port}`;
      try {
        assert.equal((await fetch(`${base}/webhooks/recurrente`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f.payload) })).status, 401);
        const signedBody = signed(f.payload);
        const post = () => fetch(`${base}/webhooks/recurrente`, { method: "POST", headers: { "Content-Type": "application/json", ...signedBody.headers }, body: signedBody.raw });
        const responses = await Promise.all([post(), post()]); assert(responses.every((r) => r.status === 200));
        assert.deepEqual((await Promise.all(responses.map((r) => r.json()))).map((r) => r.result).sort(), ["duplicate", "processed"]);
        await onePayment(f.id); assert.equal(Number((await balance(f.id)).saldo_pendiente), 0);
        assert.equal((await post()).status, 200);
        const { token } = await require("../../src/services/activeSessionsService").createActiveSession(3);
        const accountResponse = await fetch(`${base}/residente/estado-cuenta`, { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(accountResponse.status, 200);
        const account = await accountResponse.json(); const quota = account.cuotas.find((q) => q.id_cuota === f.id);
        assert.equal(quota.estado, "PAGADA"); assert.equal(quota.saldo_pendiente, 0);
        const noCharge = await fetch(`${base}/residente/pagos/recurrente/checkout`, {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ id_cuota: f.id }),
        });
        assert.equal(noCharge.status, 409); assert.equal((await noCharge.json()).code, "QUOTA_PAID");
        assert.equal(providerCalls, 0);
      } finally { await new Promise((resolve) => server.close(resolve)); }
    });
    test("HTTP funcional de fallo SQL responde 503, rollback y reintento posterior 200", async () => {
      const f = await fixture();
      const failed = createWebhookService({ pool: failingPool(/^UPDATE CHECKOUT_RECURRENTE/) });
      const app = require("../../src/app").createApp({ recurrenteWebhookHandler: createWebhookHandler({ configuration, service: failed }) });
      const server = app.listen(0, "127.0.0.1"); await new Promise((resolve) => server.once("listening", resolve));
      const body = signed(f.payload), url = `http://127.0.0.1:${server.address().port}/webhooks/recurrente`;
      const post = () => fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...body.headers }, body: body.raw });
      try {
        const first = await post(); assert.equal(first.status, 503); assert.equal((await first.json()).code, "WEBHOOK_RETRY"); await noPayment(f.id);
        const retry = await post(); assert.equal(retry.status, 200); assert.equal((await retry.json()).result, "processed"); await onePayment(f.id);
      } finally { await new Promise((resolve) => server.close(resolve)); }
    });
    test("HTTP funcional de monto/fecha inconsistentes confirma revision sin aplicar pago", async () => {
      const f = await fixture();
      const app = require("../../src/app").createApp({ recurrenteWebhookHandler: createWebhookHandler({ configuration, service }) });
      const server = app.listen(0, "127.0.0.1"); await new Promise((resolve) => server.once("listening", resolve));
      try {
        for (const changes of [{ amount_in_cents: 999 }, { created_at: null }]) {
          const body = signed({ ...f.payload, ...changes });
          const response = await fetch(`http://127.0.0.1:${server.address().port}/webhooks/recurrente`, {
            method: "POST", headers: { "Content-Type": "application/json", ...body.headers }, body: body.raw,
          });
          assert.equal(response.status, 200); assert.equal((await response.json()).result, "review"); await noPayment(f.id);
        }
      } finally { await new Promise((resolve) => server.close(resolve)); }
    });
  });
}
