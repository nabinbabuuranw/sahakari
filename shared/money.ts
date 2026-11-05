// Pure money, date and loan arithmetic shared by the Worker and the web app.
// Money is integer paisa (1 NPR = 100 paisa) so no float rounding reaches the ledger.
// Rates are basis points a year (1250 = 12.50%).

export type LoanMethod = 'reducing' | 'flat';
export type InstallmentStatus = 'paid' | 'partial' | 'overdue' | 'open';

export interface ScheduleRow {
  seq: number;
  dueAd: string;
  principal: number; // paisa
  interest: number; // paisa
  total: number; // paisa
}

export interface Schedule {
  emi: number; // paisa (the regular installment; the last one may differ by a few paisa)
  totalInterest: number;
  totalPayable: number;
  rows: ScheduleRow[];
}

/** Parses "1,25,000.50" or 125000.5 into integer paisa. Returns null when invalid or not positive. */
export function nprToPaisa(input: unknown, { allowZero = false } = {}): number | null {
  let s: string;
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return null;
    s = input.toFixed(2);
  } else if (typeof input === 'string') {
    s = input.replace(/[,\s]/g, '').replace(/^Rs\.?/i, '');
  } else return null;
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  const paisa = Number(whole) * 100 + Number((frac + '00').slice(0, 2));
  if (!Number.isSafeInteger(paisa)) return null;
  if (paisa === 0 && !allowZero) return null;
  return paisa;
}

/** Formats paisa with Nepali digit grouping (lakh style): Rs. 1,25,000.50 */
export function formatNpr(paisa: number): string {
  const neg = paisa < 0;
  const abs = Math.abs(paisa);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  const w = String(whole);
  let grouped: string;
  if (w.length <= 3) grouped = w;
  else {
    const last3 = w.slice(-3);
    const rest = w.slice(0, -3);
    grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
  }
  return `${neg ? '-' : ''}Rs.\u00a0${grouped}.${frac}`;
}

/** Adds whole calendar months to an ISO date (YYYY-MM-DD), clamping the day to the month's length. */
export function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  const nd = Math.min(d, lastDay);
  return `${ny}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}

export function isIsoDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * Builds the repayment schedule.
 * reducing: equal installments (EMI) on the outstanding balance, interest charged monthly.
 * flat: interest = principal x rate x years, spread evenly over the installments.
 * Every amount is integer paisa; the last installment absorbs rounding so the schedule closes exactly.
 */
export function buildSchedule(principal: number, annualBp: number, termMonths: number, method: LoanMethod, firstDueAd: string): Schedule {
  if (!Number.isInteger(principal) || principal <= 0) throw new RangeError('principal must be positive paisa');
  if (!Number.isInteger(termMonths) || termMonths < 1 || termMonths > 120) throw new RangeError('term must be 1 to 120 months');
  if (!Number.isInteger(annualBp) || annualBp < 0 || annualBp > 3600) throw new RangeError('rate out of range');
  const rows: ScheduleRow[] = [];
  const dueFor = (k: number) => addMonthsIso(firstDueAd, k - 1); // installment 1 falls due on firstDueAd
  if (method === 'flat') {
    const totalInterest = Math.round((principal * annualBp * termMonths) / (10000 * 12));
    const basePrin = Math.floor(principal / termMonths);
    const baseInt = Math.floor(totalInterest / termMonths);
    let prinLeft = principal;
    let intLeft = totalInterest;
    for (let i = 1; i <= termMonths; i++) {
      const last = i === termMonths;
      const p = last ? prinLeft : basePrin;
      const it = last ? intLeft : baseInt;
      prinLeft -= p;
      intLeft -= it;
      rows.push({ seq: i, dueAd: dueFor(i), principal: p, interest: it, total: p + it });
    }
    const emi = rows[0].total;
    return { emi, totalInterest, totalPayable: principal + totalInterest, rows };
  }
  const r = annualBp / 10000 / 12;
  let emi: number;
  if (r === 0) emi = Math.ceil(principal / termMonths);
  else emi = Math.round((principal * r) / (1 - Math.pow(1 + r, -termMonths)));
  let balance = principal;
  let totalInterest = 0;
  for (let i = 1; i <= termMonths; i++) {
    const interest = Math.round(balance * r);
    let p = i === termMonths ? balance : Math.min(balance, emi - interest);
    if (p < 0) p = 0;
    balance -= p;
    totalInterest += interest;
    rows.push({ seq: i, dueAd: dueFor(i), principal: p, interest, total: p + interest });
  }
  return { emi, totalInterest, totalPayable: principal + totalInterest, rows };
}

export interface Allocation {
  seq: number;
  dueAd: string;
  total: number;
  paid: number;
  interestPaid: number;
  principalPaid: number;
  remaining: number;
  status: InstallmentStatus;
}

/**
 * Applies the total of all payments to installments in order (oldest first).
 * Within an installment, interest is cleared before principal.
 */
export function allocatePayments(rows: ScheduleRow[], paidTotal: number, todayAd: string): { allocations: Allocation[]; principalOutstanding: number; amountDue: number; overdueAmount: number; overdueCount: number; nextDue: Allocation | null } {
  let pool = paidTotal;
  let principalPaidAll = 0;
  const allocations: Allocation[] = rows.map((row) => {
    const pay = Math.max(0, Math.min(pool, row.total));
    pool -= pay;
    const interestPaid = Math.min(pay, row.interest);
    const principalPaid = pay - interestPaid;
    principalPaidAll += principalPaid;
    const remaining = row.total - pay;
    let status: InstallmentStatus;
    if (remaining === 0) status = 'paid';
    else if (pay > 0) status = row.dueAd < todayAd ? 'overdue' : 'partial';
    else status = row.dueAd < todayAd ? 'overdue' : 'open';
    if (status === 'partial' && row.dueAd < todayAd) status = 'overdue';
    return { seq: row.seq, dueAd: row.dueAd, total: row.total, paid: pay, interestPaid, principalPaid, remaining, status };
  });
  const principalTotal = rows.reduce((s, r) => s + r.principal, 0);
  const amountDue = allocations.reduce((s, a) => s + a.remaining, 0);
  const overdue = allocations.filter((a) => a.status === 'overdue');
  const overdueAmount = overdue.reduce((s, a) => s + a.remaining, 0);
  const nextDue = allocations.find((a) => a.remaining > 0) ?? null;
  return {
    allocations,
    principalOutstanding: principalTotal - principalPaidAll,
    amountDue,
    overdueAmount,
    overdueCount: overdue.length,
    nextDue,
  };
}

/** Savings balance from ledger rows: deposits and interest add, withdrawals subtract. */
export function savingsBalance(rows: { kind: string; amount: number }[]): number {
  return rows.reduce((s, r) => s + (r.kind === 'withdrawal' ? -r.amount : r.amount), 0);
}

/** Maximum loan the rule allows: savings balance times the cooperative's multiplier (whole number). */
export function loanLimit(balance: number, multiplier: number): number {
  if (balance <= 0) return 0;
  return Math.floor(balance * multiplier);
}
