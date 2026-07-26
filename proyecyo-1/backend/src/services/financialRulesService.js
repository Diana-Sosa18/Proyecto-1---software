const { pool, query } = require("../database/mysql");

const TYPES = ["PORCENTAJE", "FIJO"];
const DEFAULT_RULE = { dia_limite: 10, tipo: "PORCENTAJE", porcentaje: 5, monto_fijo: 0, dias_gracia: 0, activo: true, vigente_desde: "2026-01-01" };
const KEYS = {
  dia_limite: "finanzas_dia_limite", tipo: "finanzas_tipo_recargo", porcentaje: "finanzas_porcentaje",
  monto_fijo: "finanzas_monto_fijo", dias_gracia: "finanzas_dias_gracia",
  activo: "finanzas_recargo_activo", vigente_desde: "finanzas_vigente_desde",
};

function validateRule(payload = {}) {
  const rule = {
    dia_limite: Number(payload.dia_limite), tipo: String(payload.tipo || "").toUpperCase(),
    porcentaje: Number(payload.porcentaje || 0), monto_fijo: Number(payload.monto_fijo || 0),
    dias_gracia: Number(payload.dias_gracia || 0), activo: Boolean(payload.activo),
    vigente_desde: String(payload.vigente_desde || ""),
  };
  if (!Number.isInteger(rule.dia_limite) || rule.dia_limite < 1 || rule.dia_limite > 28) throw Object.assign(new Error("El día límite debe estar entre 1 y 28."), { status: 400 });
  if (!TYPES.includes(rule.tipo)) throw Object.assign(new Error("El tipo de recargo es inválido."), { status: 400 });
  if (!Number.isFinite(rule.porcentaje) || rule.porcentaje < 0 || rule.porcentaje > 100) throw Object.assign(new Error("El porcentaje debe estar entre 0 y 100."), { status: 400 });
  if (!Number.isFinite(rule.monto_fijo) || rule.monto_fijo < 0) throw Object.assign(new Error("El monto fijo no puede ser negativo."), { status: 400 });
  if (!Number.isInteger(rule.dias_gracia) || rule.dias_gracia < 0 || rule.dias_gracia > 90) throw Object.assign(new Error("El período de gracia debe estar entre 0 y 90 días."), { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rule.vigente_desde)) throw Object.assign(new Error("La fecha de vigencia es inválida."), { status: 400 });
  if ((rule.tipo === "PORCENTAJE" && rule.monto_fijo !== 0) || (rule.tipo === "FIJO" && rule.porcentaje !== 0)) throw Object.assign(new Error("La configuración contiene valores incompatibles con el tipo."), { status: 400 });
  return rule;
}
function calculateSurcharge(balance, rule) { return Number((rule.tipo === "PORCENTAJE" ? balance * rule.porcentaje / 100 : rule.monto_fijo).toFixed(2)); }
async function getRule() {
  const rows = await query("SELECT clave, valor FROM CONFIGURACION WHERE clave IN (?, ?, ?, ?, ?, ?, ?)", Object.values(KEYS));
  const map = Object.fromEntries(rows.map((row) => [row.clave, row.valor]));
  return validateRule({
    dia_limite: map[KEYS.dia_limite] ?? DEFAULT_RULE.dia_limite, tipo: map[KEYS.tipo] ?? DEFAULT_RULE.tipo,
    porcentaje: map[KEYS.porcentaje] ?? DEFAULT_RULE.porcentaje, monto_fijo: map[KEYS.monto_fijo] ?? DEFAULT_RULE.monto_fijo,
    dias_gracia: map[KEYS.dias_gracia] ?? DEFAULT_RULE.dias_gracia, activo: map[KEYS.activo] == null ? true : map[KEYS.activo] === "true",
    vigente_desde: map[KEYS.vigente_desde] ?? DEFAULT_RULE.vigente_desde,
  });
}
async function saveRule(payload) {
  const rule = validateRule(payload);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const [name, key] of Object.entries(KEYS)) await connection.execute("INSERT INTO CONFIGURACION (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor=VALUES(valor)", [key, String(rule[name])]);
    await connection.commit();
    return rule;
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}
async function applySurcharges(userId) {
  const rule = await getRule();
  if (!rule.activo) return { aplicados: 0 };
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [fees] = await connection.execute(`
      SELECT cu.id_cuota, cu.id_casa, cu.monto, cu.fecha_limite,
        GREATEST(cu.monto-COALESCE(SUM(p.monto_pagado),0),0) saldo
      FROM CUOTA cu LEFT JOIN PAGO p ON p.id_cuota=cu.id_cuota
      WHERE cu.fecha_limite >= ? AND DATE_ADD(cu.fecha_limite, INTERVAL ? DAY) < CURDATE()
      GROUP BY cu.id_cuota HAVING saldo > 0 FOR UPDATE`, [rule.vigente_desde, rule.dias_gracia]);
    let applied = 0;
    for (const fee of fees) {
      const amount = calculateSurcharge(Number(fee.saldo), rule);
      const [result] = await connection.execute(`INSERT IGNORE INTO RECARGO_APLICADO
        (id_cuota,id_casa,tipo_regla,monto_original,monto_recargo,fecha_aplicacion,aplicado_por)
        VALUES (?,?,?,?,?,CURDATE(),?)`, [fee.id_cuota, fee.id_casa, rule.tipo, fee.saldo, amount, userId]);
      applied += Number(result.affectedRows || 0);
    }
    await connection.commit();
    return { aplicados: applied };
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}
module.exports = { getRule, saveRule, applySurcharges, validateRule, calculateSurcharge, DEFAULT_RULE };
