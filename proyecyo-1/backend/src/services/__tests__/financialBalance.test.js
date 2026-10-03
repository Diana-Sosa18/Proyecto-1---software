const { calculateBalance, assertCollectible, toCents, sumMoney } = require("../financialBalance");
const resident = require("../residentAccountService").__private__;
const tenant = require("../tenantAccountService").__private__;
const detail = require("../residentFinancialDetailService").__private__;

test.each([[50, 65, 0, 65], [10, 100, 5, 105], [115, 0, 0, 0], [0, 100, 15, 115]])(
  "abono %s aplica primero a recargos", (pagado, capital, recargos, saldo) => {
    const balance = calculateBalance({ monto: "100.00", recargo: "15.00", pagado });
    expect(balance).toMatchObject({ capital_pendiente: capital, recargo_pendiente: recargos, saldo, sobrepago: 0 });
    for (const map of [resident.mapQuota, tenant.mapQuota]) {
      expect(map({ monto: 100, recargo: 15, total_pagado: pagado })).toMatchObject({
        capital_pendiente: capital, recargo_pendiente: recargos, saldo_pendiente: saldo });
    }
    expect(detail.mapCharge({ monto: 100, recargo: 15, pagado })).toMatchObject({ saldo });
  },
);
test("sobrepago explicito no compensa otra cuota ni habilita un nuevo cobro", () => {
  const balance = calculateBalance({ monto: 100, recargo: 15, pagado: 120 });
  expect(balance).toMatchObject({ saldo: 0, sobrepago: 5, requiere_revision: true });
  expect(() => assertCollectible(balance)).toThrow(/sobrepago/);
  expect(sumMoney([balance.saldo, calculateBalance({ monto: 100 }).saldo])).toBe(100);
});
test("centavos exactos y sumas de abonos decimales", () => {
  expect(calculateBalance({ monto: "0.30", recargo: "0.10", pagado: "0.20" }).saldo).toBe(0.2);
  expect(sumMoney([0.1, 0.2])).toBe(0.3);
});
test.each([-1, "1.001", "NaN", Infinity, "", "1e3", "9007199254740992"])(
  "rechaza importe invalido %s", (amount) => expect(() => toCents(amount)).toThrow(),
);
