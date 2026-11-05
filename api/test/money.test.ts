import test from 'node:test';
import assert from 'node:assert/strict';
import { nprToPaisa, formatNpr, addMonthsIso, isIsoDate, buildSchedule, allocatePayments, savingsBalance, loanLimit } from '../../shared/money.ts';

test('nprToPaisa: accepts rupees with commas and up to two decimals, rejects the rest', () => {
  assert.equal(nprToPaisa('1,25,000'), 12500000);
  assert.equal(nprToPaisa('2500.5'), 250050);
  assert.equal(nprToPaisa('Rs. 10.25'), 1025);
  assert.equal(nprToPaisa(99.99), 9999);
  assert.equal(nprToPaisa('0'), null);
  assert.equal(nprToPaisa('0', { allowZero: true }), 0);
  assert.equal(nprToPaisa('-5'), null);
  assert.equal(nprToPaisa('1.234'), null);
  assert.equal(nprToPaisa('abc'), null);
  assert.equal(nprToPaisa(NaN), null);
  assert.equal(nprToPaisa(0.1 + 0.2), 30); // float noise rounds to two decimals, no drift in the ledger
});

test('formatNpr: lakh grouping and paisa', () => {
  assert.equal(formatNpr(12345678), 'Rs.\u00a01,23,456.78');
  assert.equal(formatNpr(100), 'Rs.\u00a01.00');
  assert.equal(formatNpr(5), 'Rs.\u00a00.05');
  assert.equal(formatNpr(-250000), '-Rs.\u00a02,500.00');
  assert.equal(formatNpr(1000000000), 'Rs.\u00a01,00,00,000.00');
});

test('dates: month arithmetic clamps to the end of the month and validates ISO', () => {
  assert.equal(addMonthsIso('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonthsIso('2024-01-31', 1), '2024-02-29');
  assert.equal(addMonthsIso('2026-11-05', 14), '2028-01-05');
  assert.equal(addMonthsIso('2026-03-15', -4), '2025-11-15');
  assert.equal(isIsoDate('2026-02-29'), false);
  assert.equal(isIsoDate('2024-02-29'), true);
  assert.equal(isIsoDate('2026-13-01'), false);
  assert.equal(isIsoDate('05/11/2026'), false);
});

test('reducing schedule: equal EMI, interest on the falling balance, closes to zero', () => {
  const s = buildSchedule(10000000, 1200, 12, 'reducing', '2026-12-01'); // Rs. 1,00,000 at 12% for 12 months
  assert.equal(s.rows.length, 12);
  const principalSum = s.rows.reduce((a, r) => a + r.principal, 0);
  assert.equal(principalSum, 10000000, 'principal repaid exactly');
  assert.equal(s.rows[0].interest, 100000, 'first month interest is 1% of 1,00,000');
  assert.ok(Math.abs(s.emi - 888488) <= 1, `EMI close to 8,884.88, got ${s.emi}`);
  assert.equal(s.totalPayable, 10000000 + s.totalInterest);
  assert.equal(s.rows.reduce((a, r) => a + r.total, 0), s.totalPayable, 'rows add up to the payable total');
  assert.equal(s.rows[11].dueAd, '2027-11-01');
});

test('flat schedule: interest is principal x rate x years, split evenly with the last row absorbing rounding', () => {
  const s = buildSchedule(5000000, 1200, 12, 'flat', '2026-12-10'); // Rs. 50,000 at 12% flat for one year
  assert.equal(s.totalInterest, 600000);
  assert.equal(s.rows.reduce((a, r) => a + r.principal, 0), 5000000);
  assert.equal(s.rows.reduce((a, r) => a + r.interest, 0), 600000);
  assert.equal(s.rows.length, 12);
});

test('zero-rate loan and odd amounts still close exactly', () => {
  const s = buildSchedule(1000001, 0, 7, 'reducing', '2026-01-01');
  assert.equal(s.totalInterest, 0);
  assert.equal(s.rows.reduce((a, r) => a + r.principal, 0), 1000001);
  const f = buildSchedule(999999, 1375, 9, 'flat', '2026-01-01');
  assert.equal(f.rows.reduce((a, r) => a + r.total, 0), f.totalPayable);
});

test('bad inputs are refused', () => {
  assert.throws(() => buildSchedule(0, 1200, 12, 'reducing', '2026-01-01'));
  assert.throws(() => buildSchedule(100, 1200, 0, 'reducing', '2026-01-01'));
  assert.throws(() => buildSchedule(100, 1200, 121, 'reducing', '2026-01-01'));
  assert.throws(() => buildSchedule(100, 4000, 12, 'reducing', '2026-01-01'));
});

test('allocation: payments clear installments in order, interest first within each', () => {
  const s = buildSchedule(10000000, 1200, 3, 'reducing', '2026-01-01');
  const r0 = s.rows[0];
  const a = allocatePayments(s.rows, r0.interest + 1000, '2025-12-20');
  assert.equal(a.allocations[0].interestPaid, r0.interest);
  assert.equal(a.allocations[0].principalPaid, 1000);
  assert.equal(a.allocations[0].status, 'partial');
  assert.equal(a.allocations[1].paid, 0);
  assert.equal(a.allocations[1].status, 'open', 'not due yet on 20 Dec for the 1 Feb installment');
  assert.equal(a.principalOutstanding, 10000000 - 1000);
  assert.equal(a.nextDue?.seq, 1);
});

test('allocation: unpaid installments past due are overdue, paid ones are paid', () => {
  const s = buildSchedule(10000000, 1200, 3, 'reducing', '2026-01-01');
  const a = allocatePayments(s.rows, s.rows[0].total, '2026-03-05');
  assert.equal(a.allocations[0].status, 'paid');
  assert.equal(a.allocations[1].status, 'overdue');
  assert.equal(a.allocations[2].status, 'overdue');
  assert.equal(a.overdueCount, 2);
  assert.equal(a.amountDue, s.rows[1].total + s.rows[2].total);
});

test('allocation: full payment leaves nothing due and no principal outstanding', () => {
  const s = buildSchedule(500000, 1000, 6, 'flat', '2026-01-01');
  const a = allocatePayments(s.rows, s.totalPayable, '2030-01-01');
  assert.equal(a.amountDue, 0);
  assert.equal(a.principalOutstanding, 0);
  assert.equal(a.overdueCount, 0);
  assert.equal(a.nextDue, null);
});

test('savings balance and loan limit rules', () => {
  assert.equal(savingsBalance([{ kind: 'deposit', amount: 500000 }, { kind: 'interest', amount: 1000 }, { kind: 'withdrawal', amount: 200000 }]), 301000);
  assert.equal(loanLimit(301000, 3), 903000);
  assert.equal(loanLimit(-5, 3), 0);
  assert.equal(loanLimit(0, 3), 0);
});
