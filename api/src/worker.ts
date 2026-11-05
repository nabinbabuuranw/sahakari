// Sahakari API: one Cloudflare Worker over D1. Serves /api/* and the SPA shell; every other path is a static asset.
import { SCHEMA } from './schema.ts';
import { hashPassword, verifyPassword, randomToken, temporaryPassword, sha256hex } from './crypto.ts';
import { nprToPaisa, buildSchedule, allocatePayments, loanLimit, isIsoDate, addMonthsIso, type LoanMethod, type ScheduleRow } from '../../shared/money.ts';
// @ts-ignore - plain ES module shared with the web app
import { adToBs, formatBs, BS_MONTHS_EN } from '../../shared/nepali-date.js';

export interface Env {
  DB: D1Database;
  ASSETS: { fetch(req: Request): Promise<Response> };
}

export const SESSION_COOKIE = 'sahakari_sid';
const SESSION_MS = 14 * 24 * 3600 * 1000;
export const DEMO_OFFICE = 'demo.office@sahakari.demo';
export const DEMO_MEMBER = 'demo.member@sahakari.demo';
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

class HttpError extends Error {
  status: number;
  code: string;
  extra: Record<string, unknown>;
  constructor(status: number, code: string, extra: Record<string, unknown> = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}
function fail(status: number, code: string, extra: Record<string, unknown> = {}): never {
  throw new HttpError(status, code, extra);
}

interface User { id: number; email: string; name: string; role: 'office' | 'member'; member_id: number | null; is_demo: number }

const now = () => Date.now();
/** Today in Kathmandu (UTC+05:45) as YYYY-MM-DD. */
export function todayAd(t = Date.now()): string {
  return new Date(t + (5 * 60 + 45) * 60000).toISOString().slice(0, 10);
}
const bsOf = (iso: string) => formatBs(adToBs(new Date(iso + 'T00:00:00Z')), 'YYYY-MM-DD');

const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-Frame-Options': 'DENY',
};

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS, ...headers },
  });
}

function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

const sessionCookie = (token: string, maxAgeS: number) =>
  `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeS}`;

async function readJson(req: Request): Promise<Record<string, any>> {
  if (req.method === 'GET' || req.method === 'HEAD') return {};
  const ct = req.headers.get('Content-Type') || '';
  if (!ct.includes('application/json')) fail(415, 'json_required');
  const len = Number(req.headers.get('Content-Length') || 0);
  if (len > 64 * 1024) fail(413, 'too_large');
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    fail(400, 'bad_json');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'bad_json');
  return body as Record<string, any>;
}

// ---------- validation ----------
const str = (v: unknown, max: number, field: string, { required = false } = {}): string => {
  if (v === undefined || v === null) {
    if (required) fail(422, 'invalid', { field, reason: 'required' });
    return '';
  }
  if (typeof v !== 'string') fail(422, 'invalid', { field, reason: 'text' });
  const s = (v as string).trim();
  if (required && !s) fail(422, 'invalid', { field, reason: 'required' });
  if (s.length > max) fail(422, 'invalid', { field, reason: `max ${max} characters` });
  return s;
};
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
export function validEmail(s: string): boolean {
  return EMAIL.test(s);
}
export function validPhone(s: string): boolean {
  const n = s.replace(/[\s-]/g, '');
  return /^(\+977)?\d{7,10}$/.test(n) && n.replace(/\D/g, '').length >= 7;
}
const dateIn = (v: unknown, field: string, fallback: string | null): string => {
  if (v === undefined || v === null || v === '') {
    if (fallback) return fallback;
    fail(422, 'invalid', { field, reason: 'date required' });
  }
  if (!isIsoDate(v)) fail(422, 'invalid', { field, reason: 'date as YYYY-MM-DD' });
  const d = v as string;
  if (d < '2000-01-01' || d > addMonthsIso(todayAd(), 1)) fail(422, 'invalid', { field, reason: 'date outside the allowed range' });
  return d;
};
const intIn = (v: unknown, field: string, min: number, max: number): number => {
  const n = typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) fail(422, 'invalid', { field, reason: `whole number ${min} to ${max}` });
  return n as number;
};
const pctIn = (v: unknown, field: string, max: number): number => {
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > max) fail(422, 'invalid', { field, reason: `a percentage from 0 to ${max}` });
  return Math.round((n as number) * 100);
};
const amountIn = (v: unknown, field: string): number => {
  const p = nprToPaisa(v);
  if (p === null) fail(422, 'invalid', { field, reason: 'a positive amount in rupees, up to 2 decimals' });
  if ((p as number) > 1e12) fail(422, 'invalid', { field, reason: 'amount too large' });
  return p as number;
};
const passwordIn = (v: unknown, field = 'password'): string => {
  if (typeof v !== 'string' || v.length < 8) fail(422, 'invalid', { field, reason: 'at least 8 characters' });
  if ((v as string).length > 200) fail(422, 'invalid', { field, reason: 'too long' });
  return v as string;
};

// ---------- rate limiting (D1 counters) ----------
async function underLimit(env: Env, bucket: string, max: number, windowMs: number): Promise<boolean> {
  const t = now();
  await env.DB.prepare(
    `INSERT INTO rate_limits (bucket, count, reset_at) VALUES (?, 1, ?)
     ON CONFLICT(bucket) DO UPDATE SET
       count = CASE WHEN reset_at < ? THEN 1 ELSE count + 1 END,
       reset_at = CASE WHEN reset_at < ? THEN ? ELSE reset_at END`,
  ).bind(bucket, t + windowMs, t, t, t + windowMs).run();
  const row = await env.DB.prepare('SELECT count FROM rate_limits WHERE bucket = ?').bind(bucket).first<{ count: number }>();
  return (row?.count ?? 0) <= max;
}

// ---------- session ----------
async function currentUser(req: Request, env: Env): Promise<User | null> {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const id = await sha256hex(token);
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.role, u.member_id, u.is_demo FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > ? AND u.disabled = 0`,
  ).bind(id, now()).first<User>();
  return row ?? null;
}

async function createSession(env: Env, userId: number): Promise<string> {
  const token = randomToken(32);
  await env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256hex(token), userId, now() + SESSION_MS, now()).run();
  return token;
}

async function audit(env: Env, actor: { id: number | null; email: string }, action: string, target: string, detail = '') {
  await env.DB.prepare('INSERT INTO audit_log (actor_id, actor_email, action, target, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(actor.id, actor.email, action, target, detail.slice(0, 500), now()).run();
}

const requireOffice = (u: User | null): User => {
  if (!u) fail(401, 'sign_in_required');
  if (u!.role !== 'office') fail(403, 'office_only');
  return u!;
};

// ---------- data helpers ----------
async function settings(env: Env) {
  const row = await env.DB.prepare('SELECT * FROM coop_settings WHERE id = 1').first<any>();
  if (!row) fail(500, 'settings_missing');
  return row as { name: string; reg_no: string; address: string; phone: string; savings_rate_bp: number; loan_rate_bp: number; loan_multiplier: number };
}

async function savingsBalanceOf(env: Env, memberId: number): Promise<number> {
  const r = await env.DB.prepare(
    `SELECT COALESCE(SUM(CASE WHEN kind = 'withdrawal' THEN -amount ELSE amount END), 0) AS b FROM savings_txn WHERE member_id = ?`,
  ).bind(memberId).first<{ b: number }>();
  return Number(r?.b ?? 0);
}

async function newMemberCode(env: Env): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    let s = 'SHK-';
    for (const b of bytes) s += CODE_ALPHABET[b % CODE_ALPHABET.length];
    const hit = await env.DB.prepare('SELECT id FROM members WHERE member_code = ?').bind(s).first();
    if (!hit) return s;
  }
  fail(500, 'code_failed');
}

interface LoanRow {
  id: number; member_id: number; principal: number; annual_bp: number; term_months: number; method: LoanMethod;
  emi: number; total_interest: number; purpose: string; disbursed_ad: string; disbursed_bs: string; first_due_ad: string;
  status: 'active' | 'closed'; is_demo: number;
}

/** The full view of one loan: schedule with allocation, payments, and the summary the screens show. */
async function loanView(env: Env, loanId: number, today = todayAd()) {
  const loan = await env.DB.prepare(
    `SELECT l.*, m.full_name AS member_name, m.member_no AS member_no FROM loans l JOIN members m ON m.id = l.member_id WHERE l.id = ?`,
  ).bind(loanId).first<LoanRow & { member_name: string; member_no: string }>();
  if (!loan) return null;
  const inst = await env.DB.prepare('SELECT seq, due_ad, due_bs, principal, interest FROM loan_installments WHERE loan_id = ? ORDER BY seq').bind(loanId).all<any>();
  const pays = await env.DB.prepare('SELECT id, amount, paid_ad, paid_bs, note FROM loan_payments WHERE loan_id = ? ORDER BY paid_ad, id').bind(loanId).all<any>();
  const rows: ScheduleRow[] = inst.results.map((r: any) => ({ seq: r.seq, dueAd: r.due_ad, principal: r.principal, interest: r.interest, total: r.principal + r.interest }));
  const paidTotal = pays.results.reduce((s: number, p: any) => s + Number(p.amount), 0);
  const a = allocatePayments(rows, paidTotal, today);
  const schedule = a.allocations.map((x, i) => ({
    ...x,
    dueBs: inst.results[i].due_bs,
    principalDue: rows[i].principal,
    interestDue: rows[i].interest,
  }));
  return {
    id: loan.id,
    memberId: loan.member_id,
    memberName: loan.member_name,
    memberNo: loan.member_no,
    principal: loan.principal,
    annualRatePct: loan.annual_bp / 100,
    termMonths: loan.term_months,
    method: loan.method,
    emi: loan.emi,
    totalInterest: loan.total_interest,
    totalPayable: loan.principal + loan.total_interest,
    purpose: loan.purpose,
    disbursedAd: loan.disbursed_ad,
    disbursedBs: loan.disbursed_bs,
    firstDueAd: loan.first_due_ad,
    status: loan.status,
    isDemo: !!loan.is_demo,
    schedule,
    payments: pays.results.map((p: any) => ({ id: p.id, amount: p.amount, paidAd: p.paid_ad, paidBs: p.paid_bs, note: p.note })),
    summary: {
      paidTotal,
      principalOutstanding: a.principalOutstanding,
      amountDue: a.amountDue,
      overdueAmount: a.overdueAmount,
      overdueCount: a.overdueCount,
      nextDue: a.nextDue ? { seq: a.nextDue.seq, dueAd: a.nextDue.dueAd, remaining: a.nextDue.remaining, status: a.nextDue.status } : null,
    },
  };
}

async function createLoan(env: Env, p: { memberId: number; principal: number; annualBp: number; termMonths: number; method: LoanMethod; purpose: string; disbursedAd: string; firstDueAd: string; isDemo: number; actor: User | null }) {
  const sched = buildSchedule(p.principal, p.annualBp, p.termMonths, p.method, p.firstDueAd);
  const res = await env.DB.prepare(
    `INSERT INTO loans (member_id, principal, annual_bp, term_months, method, emi, total_interest, purpose, disbursed_ad, disbursed_bs, first_due_ad, status, is_demo, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
  ).bind(p.memberId, p.principal, p.annualBp, p.termMonths, p.method, sched.emi, sched.totalInterest, p.purpose, p.disbursedAd, bsOf(p.disbursedAd), p.firstDueAd, p.isDemo, p.actor?.id ?? null, now()).run();
  const loanId = Number(res.meta.last_row_id);
  await env.DB.batch(sched.rows.map((r) =>
    env.DB.prepare('INSERT INTO loan_installments (loan_id, seq, due_ad, due_bs, principal, interest) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(loanId, r.seq, r.dueAd, bsOf(r.dueAd), r.principal, r.interest),
  ));
  return loanId;
}

async function recordPayment(env: Env, loanId: number, amount: number, paidAd: string, note: string, actor: User | null) {
  const view = await loanView(env, loanId);
  if (!view) fail(404, 'not_found');
  if (view!.status !== 'active') fail(409, 'loan_closed');
  if (amount > view!.summary.amountDue) fail(422, 'over_due', { amount_due: view!.summary.amountDue });
  await env.DB.prepare('INSERT INTO loan_payments (loan_id, amount, paid_ad, paid_bs, note, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(loanId, amount, paidAd, bsOf(paidAd), note, actor?.id ?? null, now()).run();
  if (view!.summary.amountDue - amount === 0) {
    await env.DB.prepare(`UPDATE loans SET status = 'closed' WHERE id = ?`).bind(loanId).run();
  }
  return loanView(env, loanId);
}

// ---------- demo data ----------
async function seedDemo(env: Env, force = false) {
  const flag = await env.DB.prepare(`SELECT v FROM meta WHERE k = 'demo_seed'`).first();
  if (flag && !force) return;
  await env.DB.batch([env.DB.prepare('DELETE FROM users WHERE is_demo = 1'), env.DB.prepare('DELETE FROM members WHERE is_demo = 1')]);
  const t = now();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO coop_settings (id, name, reg_no, address, phone, savings_rate_bp, loan_rate_bp, loan_multiplier, updated_at)
     VALUES (1, 'Sahakari Savings and Loan Cooperative', '', '', '', 500, 1200, 3, ?)`,
  ).bind(t).run();
  const hash = await hashPassword(randomToken(24));
  const today = todayAd();
  const demoMembers = [
    { name: 'Sunita Rai', phone: '9800000001', joinedMonthsAgo: 14, status: 'active', address: 'Demo address, Inaruwa' },
    { name: 'Bikash Thapa', phone: '9800000002', joinedMonthsAgo: 12, status: 'active', address: 'Demo address, Dharan' },
    { name: 'Anita Gurung', phone: '9800000003', joinedMonthsAgo: 8, status: 'active', address: 'Demo address, Biratnagar' },
    { name: 'Ram Bahadur Shrestha', phone: '9800000004', joinedMonthsAgo: 10, status: 'active', address: 'Demo address, Itahari' },
    { name: 'Kamala Tamang', phone: '9800000005', joinedMonthsAgo: 6, status: 'inactive', address: 'Demo address, Damak' },
  ];
  const ids: number[] = [];
  for (const m of demoMembers) {
    const joined = addMonthsIso(today, -m.joinedMonthsAgo);
    const code = await newMemberCode(env);
    const r = await env.DB.prepare(
      `INSERT INTO members (member_no, member_code, full_name, phone, address, nominee_name, nominee_relation, joined_ad, joined_bs, status, is_demo, created_at)
       VALUES ('TMP', ?, ?, ?, ?, 'Demo nominee', 'Family', ?, ?, ?, 1, ?)`,
    ).bind(code, m.name, m.phone, m.address, joined, bsOf(joined), m.status, t).run();
    const id = Number(r.meta.last_row_id);
    await env.DB.prepare(`UPDATE members SET member_no = ? WHERE id = ?`).bind('M' + String(id).padStart(4, '0'), id).run();
    ids.push(id);
    // monthly savings for each month since joining
    const deposits: any[] = [];
    for (let k = m.joinedMonthsAgo; k >= 0; k--) {
      const d = addMonthsIso(today, -k);
      const amt = m.name.startsWith('Kamala') ? 500 : m.name.startsWith('Anita') ? 1500 : 2000;
      deposits.push(env.DB.prepare(`INSERT INTO savings_txn (member_id, kind, amount, txn_ad, txn_bs, note, created_by, created_at) VALUES (?, 'deposit', ?, ?, ?, 'Monthly savings (DEMO)', NULL, ?)`).bind(id, amt * 100, d, bsOf(d), t));
    }
    await env.DB.batch(deposits);
  }
  // one withdrawal and one interest posting for flavour
  const kamala = ids[4];
  await env.DB.prepare(`INSERT INTO savings_txn (member_id, kind, amount, txn_ad, txn_bs, note, created_by, created_at) VALUES (?, 'withdrawal', 50000, ?, ?, 'Emergency withdrawal (DEMO)', NULL, ?)`)
    .bind(kamala, addMonthsIso(today, -1), bsOf(addMonthsIso(today, -1)), t).run();
  const sunita = ids[0];
  const bal = await savingsBalanceOf(env, sunita);
  const intAmt = Math.round((bal * 500 * 3) / (10000 * 12));
  await env.DB.prepare(`INSERT INTO savings_txn (member_id, kind, amount, txn_ad, txn_bs, note, created_by, created_at) VALUES (?, 'interest', ?, ?, ?, 'Quarterly interest at 5% (DEMO)', NULL, ?)`)
    .bind(sunita, intAmt, today, bsOf(today), t).run();

  // loans: Sunita active and paid on time except one partial; Bikash closed; Ram active and overdue
  const sunitaLoan = await createLoan(env, { memberId: sunita, principal: 15000000, annualBp: 1200, termMonths: 36, method: 'reducing', purpose: 'Shop stock (DEMO)', disbursedAd: addMonthsIso(today, -5), firstDueAd: addMonthsIso(today, -4), isDemo: 1, actor: null });
  const sunitaSched = (await loanView(env, sunitaLoan))!.schedule;
  const emiS = sunitaSched[0].total;
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO loan_payments (loan_id, amount, paid_ad, paid_bs, note, created_by, created_at) VALUES (?, ?, ?, ?, 'Installment (DEMO)', NULL, ?)`).bind(sunitaLoan, emiS, addMonthsIso(today, -4), bsOf(addMonthsIso(today, -4)), t),
    env.DB.prepare(`INSERT INTO loan_payments (loan_id, amount, paid_ad, paid_bs, note, created_by, created_at) VALUES (?, ?, ?, ?, 'Installment (DEMO)', NULL, ?)`).bind(sunitaLoan, emiS, addMonthsIso(today, -3), bsOf(addMonthsIso(today, -3)), t),
    env.DB.prepare(`INSERT INTO loan_payments (loan_id, amount, paid_ad, paid_bs, note, created_by, created_at) VALUES (?, ?, ?, ?, 'Part payment (DEMO)', NULL, ?)`).bind(sunitaLoan, Math.floor(emiS / 2), addMonthsIso(today, -2), bsOf(addMonthsIso(today, -2)), t),
  ]);
  const bikashLoan = await createLoan(env, { memberId: ids[1], principal: 5000000, annualBp: 1200, termMonths: 12, method: 'flat', purpose: 'Tools (DEMO)', disbursedAd: addMonthsIso(today, -12), firstDueAd: addMonthsIso(today, -11), isDemo: 1, actor: null });
  const bView = (await loanView(env, bikashLoan))!;
  await env.DB.prepare(`INSERT INTO loan_payments (loan_id, amount, paid_ad, paid_bs, note, created_by, created_at) VALUES (?, ?, ?, ?, 'Final settlement (DEMO)', NULL, ?)`)
    .bind(bikashLoan, bView.totalPayable, addMonthsIso(today, -1), bsOf(addMonthsIso(today, -1)), t).run();
  await env.DB.prepare(`UPDATE loans SET status = 'closed' WHERE id = ?`).bind(bikashLoan).run();
  await createLoan(env, { memberId: ids[3], principal: 20000000, annualBp: 1250, termMonths: 24, method: 'reducing', purpose: 'Motorbike for delivery work (DEMO)', disbursedAd: addMonthsIso(today, -3), firstDueAd: addMonthsIso(today, -2), isDemo: 1, actor: null });

  // demo logins
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO users (email, name, pw_hash, role, member_id, is_demo, disabled, created_at) VALUES (?, 'Demo office (DEMO)', ?, 'office', NULL, 1, 0, ?)`).bind(DEMO_OFFICE, hash, t),
    env.DB.prepare(`INSERT INTO users (email, name, pw_hash, role, member_id, is_demo, disabled, created_at) VALUES (?, 'Sunita Rai (DEMO)', ?, 'member', ?, 1, 0, ?)`).bind(DEMO_MEMBER, hash, sunita, t),
  ]);
  await env.DB.prepare(`INSERT OR REPLACE INTO meta (k, v) VALUES ('demo_seed', ?)`).bind(String(t)).run();
}

// ---------- handlers ----------
async function dashboard(env: Env, user: User) {
  const today = todayAd();
  const cfg = await settings(env);
  const members = await env.DB.prepare(`SELECT COUNT(*) AS n, SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active FROM members`).first<any>();
  const savings = await env.DB.prepare(`SELECT COALESCE(SUM(CASE WHEN kind = 'withdrawal' THEN -amount ELSE amount END), 0) AS b FROM savings_txn`).first<any>();
  const loanIds = await env.DB.prepare(`SELECT id FROM loans WHERE status = 'active' ORDER BY id LIMIT 500`).all<{ id: number }>();
  let principalOutstanding = 0, overdueAmount = 0, overdueCount = 0;
  const overdueLoans: any[] = [];
  for (const { id } of loanIds.results) {
    const v = await loanView(env, id, today);
    if (!v) continue;
    principalOutstanding += v.summary.principalOutstanding;
    overdueAmount += v.summary.overdueAmount;
    overdueCount += v.summary.overdueCount;
    if (v.summary.overdueCount > 0) overdueLoans.push({ id: v.id, memberName: v.memberName, memberNo: v.memberNo, overdueAmount: v.summary.overdueAmount, overdueCount: v.summary.overdueCount, purpose: v.purpose });
  }
  // cash in and out by Bikram Sambat month, the last six BS months (AD months straddle BS months, so BS is the honest bucket)
  const todayBs = bsOf(today).split('-').map(Number);
  const keys: { ym: string; label: string; cashIn: number; cashOut: number }[] = [];
  for (let k = 5; k >= 0; k--) {
    let y = todayBs[0], mth = todayBs[1] - k;
    while (mth < 1) { mth += 12; y -= 1; }
    const ym = `${y}-${String(mth).padStart(2, '0')}`;
    keys.push({ ym, label: `${BS_MONTHS_EN[mth - 1]} ${y}`, cashIn: 0, cashOut: 0 });
  }
  const startAd = addMonthsIso(today, -7);
  const series = await env.DB.prepare(
    `SELECT substr(txn_bs, 1, 7) AS ym, kind AS k, SUM(amount) AS total FROM savings_txn WHERE txn_ad >= ? AND kind IN ('deposit','withdrawal') GROUP BY ym, k
     UNION ALL SELECT substr(paid_bs, 1, 7), 'repayment', SUM(amount) FROM loan_payments WHERE paid_ad >= ? GROUP BY 1
     UNION ALL SELECT substr(disbursed_bs, 1, 7), 'disbursement', SUM(principal) FROM loans WHERE disbursed_ad >= ? GROUP BY 1`,
  ).bind(startAd, startAd, startAd).all<any>();
  for (const r of series.results) {
    const m = keys.find((x) => x.ym === r.ym);
    if (!m) continue;
    const total = Number(r.total);
    if (r.k === 'deposit' || r.k === 'repayment') m.cashIn += total;
    else m.cashOut += total;
  }
  const months = keys;
  const recent = await env.DB.prepare(
    `SELECT s.txn_ad AS date, s.kind AS kind, m.full_name AS member, s.amount AS amount FROM savings_txn s JOIN members m ON m.id = s.member_id ORDER BY s.id DESC LIMIT 6`,
  ).all<any>();
  return {
    coop: { name: cfg.name, regNo: cfg.reg_no },
    isDemo: !!user.is_demo,
    today: { ad: today, bs: bsOf(today) },
    totals: {
      members: Number(members?.n ?? 0),
      activeMembers: Number(members?.active ?? 0),
      savingsBalance: Number(savings?.b ?? 0),
      activeLoans: loanIds.results.length,
      principalOutstanding,
      overdueAmount,
      overdueCount,
    },
    overdueLoans: overdueLoans.slice(0, 8),
    months,
    recent: recent.results,
  };
}

async function memberList(env: Env, q: string, status: string) {
  const like = `%${q.replace(/[%_]/g, '')}%`;
  const statusSql = status === 'active' || status === 'inactive' ? ' AND m.status = ?' : '';
  const binds: unknown[] = [like, like, like];
  if (statusSql) binds.push(status);
  const rows = await env.DB.prepare(
    `SELECT m.id, m.member_no, m.full_name, m.phone, m.status, m.joined_ad, m.joined_bs, m.is_demo,
       (SELECT COALESCE(SUM(CASE WHEN kind = 'withdrawal' THEN -amount ELSE amount END), 0) FROM savings_txn s WHERE s.member_id = m.id) AS savings_balance,
       (SELECT COUNT(*) FROM loans l WHERE l.member_id = m.id AND l.status = 'active') AS active_loans
     FROM members m WHERE (m.full_name LIKE ? OR m.member_no LIKE ? OR m.phone LIKE ?)${statusSql}
     ORDER BY m.full_name COLLATE NOCASE LIMIT 500`,
  ).bind(...binds).all<any>();
  return rows.results.map((r) => ({ ...r, is_demo: !!r.is_demo }));
}

async function memberDetail(env: Env, id: number, office: boolean) {
  const m = await env.DB.prepare('SELECT * FROM members WHERE id = ?').bind(id).first<any>();
  if (!m) fail(404, 'not_found');
  const linked = await env.DB.prepare('SELECT email FROM users WHERE member_id = ?').bind(id).first<{ email: string }>();
  const loanRows = await env.DB.prepare('SELECT id FROM loans WHERE member_id = ? ORDER BY id DESC').bind(id).all<{ id: number }>();
  const loans = [];
  for (const { id: lid } of loanRows.results) {
    const v = await loanView(env, lid);
    if (v) loans.push({ id: v.id, principal: v.principal, emi: v.emi, status: v.status, disbursedAd: v.disbursedAd, disbursedBs: v.disbursedBs, purpose: v.purpose, summary: v.summary });
  }
  const base = {
    id: m.id,
    memberNo: m.member_no,
    fullName: m.full_name,
    phone: m.phone,
    address: m.address,
    nomineeName: m.nominee_name,
    nomineeRelation: m.nominee_relation,
    joinedAd: m.joined_ad,
    joinedBs: m.joined_bs,
    status: m.status,
    isDemo: !!m.is_demo,
    savingsBalance: await savingsBalanceOf(env, id),
    loans,
  };
  if (office) return { ...base, memberCode: m.member_code, loginEmail: linked?.email ?? null };
  return base;
}

async function savingsLedger(env: Env, memberId: number) {
  const rows = await env.DB.prepare(
    'SELECT id, kind, amount, txn_ad, txn_bs, note FROM savings_txn WHERE member_id = ? ORDER BY txn_ad, id',
  ).bind(memberId).all<any>();
  let running = 0;
  return rows.results.map((r) => {
    running += r.kind === 'withdrawal' ? -r.amount : r.amount;
    return { id: r.id, kind: r.kind, amount: r.amount, dateAd: r.txn_ad, dateBs: r.txn_bs, note: r.note, balance: running };
  });
}

async function cashbook(env: Env, from: string, to: string) {
  const union = `SELECT s.txn_ad AS date, s.txn_bs AS bs, s.kind AS kind, m.full_name AS member, s.note AS note, s.amount AS amount
       FROM savings_txn s JOIN members m ON m.id = s.member_id WHERE s.txn_ad BETWEEN ? AND ?
     UNION ALL SELECT p.paid_ad, p.paid_bs, 'repayment', m.full_name, p.note, p.amount
       FROM loan_payments p JOIN loans l ON l.id = p.loan_id JOIN members m ON m.id = l.member_id WHERE p.paid_ad BETWEEN ? AND ?
     UNION ALL SELECT l.disbursed_ad, l.disbursed_bs, 'disbursement', m.full_name, l.purpose, l.principal
       FROM loans l JOIN members m ON m.id = l.member_id WHERE l.disbursed_ad BETWEEN ? AND ?`;
  const binds = [from, to, from, to, from, to];
  const rows = await env.DB.prepare(`${union} ORDER BY date DESC, kind LIMIT 500`).bind(...binds).all<any>();
  const totals = await env.DB.prepare(`SELECT kind, SUM(amount) AS total FROM (${union}) GROUP BY kind`).bind(...binds).all<any>();
  const t: Record<string, number> = {};
  for (const r of totals.results) t[r.kind] = Number(r.total);
  const cashIn = (t.deposit ?? 0) + (t.repayment ?? 0);
  const cashOut = (t.withdrawal ?? 0) + (t.disbursement ?? 0);
  return {
    from,
    to,
    rows: rows.results.map((r) => ({ date: r.date, bs: r.bs, kind: r.kind, member: r.member, note: r.note, amount: r.amount })),
    totals: { cashIn, cashOut, net: cashIn - cashOut, interestCredited: t.interest ?? 0 },
    note: 'Cash in and out cover what was received or paid in cash. Interest credited is a book entry and is not counted as cash.',
  };
}

async function statement(env: Env, memberId: number) {
  const member = await memberDetail(env, memberId, false);
  const savings = await savingsLedger(env, memberId);
  const loanRows = await env.DB.prepare('SELECT id FROM loans WHERE member_id = ? ORDER BY disbursed_ad, id').bind(memberId).all<{ id: number }>();
  const loans = [];
  for (const { id } of loanRows.results) {
    const v = await loanView(env, id);
    if (v) loans.push(v);
  }
  const cfg = await settings(env);
  return {
    coop: { name: cfg.name, regNo: cfg.reg_no, address: cfg.address, phone: cfg.phone },
    generatedAd: todayAd(),
    generatedBs: bsOf(todayAd()),
    member,
    savings,
    savingsBalance: member.savingsBalance,
    loans,
    isDemo: member.isDemo,
  };
}

async function handleApi(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = req.method.toUpperCase();
  const ip = req.headers.get('CF-Connecting-IP') || 'local';
  await ensureReady(env);

  // Same-origin guard for state changes: JSON bodies only (a cross-site form cannot send them), plus Origin when present.
  if (!['GET', 'HEAD'].includes(method)) {
    const origin = req.headers.get('Origin');
    if (origin && new URL(origin).host !== url.host) fail(403, 'cross_site');
  }

  if (path === '/api/health' && method === 'GET') return json({ ok: true });

  // ----- auth -----
  if (path === '/api/auth/login' && method === 'POST') {
    const b = await readJson(req);
    const email = str(b.email, 190, 'email', { required: true }).toLowerCase();
    const password = typeof b.password === 'string' ? b.password : '';
    if (!(await underLimit(env, `login:ip:${ip}`, 30, 15 * 60000)) || !(await underLimit(env, `login:acct:${email}`, 10, 15 * 60000))) {
      fail(429, 'too_many_attempts');
    }
    const row = await env.DB.prepare('SELECT id, email, name, role, member_id, is_demo, pw_hash FROM users WHERE email = ? AND disabled = 0').bind(email).first<any>();
    const ok = row ? await verifyPassword(password, row.pw_hash) : (await verifyPassword(password, 'pbkdf2$1000$AAAAAAAAAAAAAAAAAAAAAA$AAAA'), false);
    if (!row || !ok) fail(401, 'wrong_credentials');
    const token = await createSession(env, row.id);
    return json({ user: publicUser(row) }, 200, { 'Set-Cookie': sessionCookie(token, SESSION_MS / 1000) });
  }

  if (path === '/api/auth/demo' && method === 'POST') {
    if (!(await underLimit(env, `demo:ip:${ip}`, 60, 3600000))) fail(429, 'too_many_attempts');
    const b = await readJson(req);
    const email = b.role === 'member' ? DEMO_MEMBER : DEMO_OFFICE;
    const row = await env.DB.prepare('SELECT id, email, name, role, member_id, is_demo FROM users WHERE email = ? AND is_demo = 1').bind(email).first<any>();
    if (!row) fail(404, 'demo_missing');
    const token = await createSession(env, row.id);
    return json({ user: publicUser(row) }, 200, { 'Set-Cookie': sessionCookie(token, SESSION_MS / 1000) });
  }

  if (path === '/api/auth/logout' && method === 'POST') {
    const token = readCookie(req, SESSION_COOKIE);
    if (token) await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256hex(token)).run();
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
  }

  if (path === '/api/auth/register' && method === 'POST') {
    if (!(await underLimit(env, `register:ip:${ip}`, 10, 3600000))) fail(429, 'too_many_attempts');
    const b = await readJson(req);
    const code = str(b.member_code, 20, 'member_code', { required: true }).toUpperCase();
    if (!/^SHK-[A-Z2-9]{6}$/.test(code)) fail(422, 'invalid', { field: 'member_code', reason: 'the code looks like SHK-XXXXXX' });
    const email = str(b.email, 190, 'email', { required: true }).toLowerCase();
    if (!validEmail(email)) fail(422, 'invalid', { field: 'email', reason: 'a valid email address' });
    const password = passwordIn(b.password);
    const member = await env.DB.prepare(
      `SELECT m.id, m.full_name, m.status FROM members m WHERE m.member_code = ? AND NOT EXISTS (SELECT 1 FROM users u WHERE u.member_id = m.id)`,
    ).bind(code).first<any>();
    if (!member) fail(422, 'code_not_usable');
    if (member.status !== 'active') fail(422, 'code_not_usable');
    const exists = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (exists) fail(409, 'email_taken');
    const hash = await hashPassword(password);
    const name = str(b.name, 120, 'name') || member.full_name;
    try {
      const r = await env.DB.prepare(`INSERT INTO users (email, name, pw_hash, role, member_id, is_demo, disabled, created_at) VALUES (?, ?, ?, 'member', ?, 0, 0, ?)`)
        .bind(email, name, hash, member.id, now()).run();
      const id = Number(r.meta.last_row_id);
      await audit(env, { id, email }, 'member.register', `member:${member.id}`, 'member account created from office code');
      const token = await createSession(env, id);
      return json({ user: publicUser({ id, email, name, role: 'member', member_id: member.id, is_demo: 0 }) }, 201, { 'Set-Cookie': sessionCookie(token, SESSION_MS / 1000) });
    } catch (e: any) {
      if (String(e?.message || e).includes('UNIQUE')) fail(422, 'code_not_usable');
      throw e;
    }
  }

  const me = await currentUser(req, env);

  if (path === '/api/auth/me' && method === 'GET') {
    if (!me) return json({ user: null });
    return json({ user: publicUser(me!) });
  }

  if (path === '/api/auth/change-password' && method === 'POST') {
    if (!me) fail(401, 'sign_in_required');
    const b = await readJson(req);
    const row = await env.DB.prepare('SELECT pw_hash FROM users WHERE id = ?').bind(me!.id).first<any>();
    if (!(await verifyPassword(typeof b.current === 'string' ? b.current : '', row.pw_hash))) fail(401, 'wrong_current_password');
    const next = passwordIn(b.next, 'next');
    await env.DB.prepare('UPDATE users SET pw_hash = ? WHERE id = ?').bind(await hashPassword(next), me!.id).run();
    const token = readCookie(req, SESSION_COOKIE);
    await env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').bind(me!.id, token ? await sha256hex(token) : '').run();
    await audit(env, me!, 'auth.password_changed', `user:${me!.id}`);
    return json({ ok: true });
  }

  // everything below needs a signed-in user
  if (path.startsWith('/api/')) {
    if (!me) fail(401, 'sign_in_required');
  }
  const user = me!;

  if (path === '/api/dashboard' && method === 'GET') {
    requireOffice(user);
    return json(await dashboard(env, user));
  }

  if (path === '/api/settings') {
    requireOffice(user);
    if (method === 'GET') return json(await settingsView(env));
    if (method === 'PUT') {
      const b = await readJson(req);
      const name = str(b.name, 120, 'name', { required: true });
      const regNo = str(b.reg_no, 60, 'reg_no');
      const address = str(b.address, 200, 'address');
      const phone = str(b.phone, 30, 'phone');
      if (phone && !validPhone(phone)) fail(422, 'invalid', { field: 'phone', reason: 'a phone number' });
      const savingsBp = pctIn(b.savings_rate_pct, 'savings_rate_pct', 20);
      const loanBp = pctIn(b.loan_rate_pct, 'loan_rate_pct', 36);
      const mult = intIn(b.loan_multiplier, 'loan_multiplier', 1, 10);
      await env.DB.prepare(
        `UPDATE coop_settings SET name = ?, reg_no = ?, address = ?, phone = ?, savings_rate_bp = ?, loan_rate_bp = ?, loan_multiplier = ?, updated_at = ? WHERE id = 1`,
      ).bind(name, regNo, address, phone, savingsBp, loanBp, mult, now()).run();
      await audit(env, user, 'settings.updated', 'coop_settings:1', `savings ${savingsBp / 100}%, loans ${loanBp / 100}%, multiplier ${mult}x`);
      return json(await settingsView(env));
    }
  }

  if (path === '/api/members') {
    requireOffice(user);
    if (method === 'GET') {
      const q = url.searchParams.get('q') || '';
      const status = url.searchParams.get('status') || 'all';
      return json({ members: await memberList(env, q, status) });
    }
    if (method === 'POST') {
      const b = await readJson(req);
      const fullName = str(b.full_name, 120, 'full_name', { required: true });
      const phone = str(b.phone, 30, 'phone');
      if (phone && !validPhone(phone)) fail(422, 'invalid', { field: 'phone', reason: 'a phone number' });
      const joined = dateIn(b.joined_ad, 'joined_ad', todayAd());
      const code = await newMemberCode(env);
      const r = await env.DB.prepare(
        `INSERT INTO members (member_no, member_code, full_name, phone, address, nominee_name, nominee_relation, joined_ad, joined_bs, status, is_demo, created_at)
         VALUES ('TMP', ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, ?)`,
      ).bind(code, fullName, phone, str(b.address, 200, 'address'), str(b.nominee_name, 120, 'nominee_name'), str(b.nominee_relation, 60, 'nominee_relation'), joined, bsOf(joined), now()).run();
      const id = Number(r.meta.last_row_id);
      await env.DB.prepare('UPDATE members SET member_no = ? WHERE id = ?').bind('M' + String(id).padStart(4, '0'), id).run();
      await audit(env, user, 'member.created', `member:${id}`, fullName);
      return json(await memberDetail(env, id, true), 201);
    }
  }

  let m: RegExpMatchArray | null;
  if ((m = path.match(/^\/api\/members\/(\d+)$/))) {
    const id = Number(m[1]);
    if (method === 'GET') {
      if (user.role === 'member' && user.member_id !== id) fail(403, 'not_yours');
      return json(await memberDetail(env, id, user.role === 'office'));
    }
    requireOffice(user);
    if (method === 'PATCH') {
      const existing = await env.DB.prepare('SELECT * FROM members WHERE id = ?').bind(id).first<any>();
      if (!existing) fail(404, 'not_found');
      const b = await readJson(req);
      const fullName = b.full_name !== undefined ? str(b.full_name, 120, 'full_name', { required: true }) : existing.full_name;
      const phone = b.phone !== undefined ? str(b.phone, 30, 'phone') : existing.phone;
      if (phone && !validPhone(phone)) fail(422, 'invalid', { field: 'phone', reason: 'a phone number' });
      const status = b.status !== undefined ? b.status : existing.status;
      if (status !== 'active' && status !== 'inactive') fail(422, 'invalid', { field: 'status' });
      await env.DB.prepare(
        `UPDATE members SET full_name = ?, phone = ?, address = ?, nominee_name = ?, nominee_relation = ?, status = ? WHERE id = ?`,
      ).bind(
        fullName, phone,
        b.address !== undefined ? str(b.address, 200, 'address') : existing.address,
        b.nominee_name !== undefined ? str(b.nominee_name, 120, 'nominee_name') : existing.nominee_name,
        b.nominee_relation !== undefined ? str(b.nominee_relation, 60, 'nominee_relation') : existing.nominee_relation,
        status, id,
      ).run();
      await audit(env, user, 'member.updated', `member:${id}`, `status ${status}`);
      return json(await memberDetail(env, id, true));
    }
  }

  if ((m = path.match(/^\/api\/members\/(\d+)\/reset-password$/)) && method === 'POST') {
    requireOffice(user);
    const id = Number(m[1]);
    const linked = await env.DB.prepare('SELECT id, email FROM users WHERE member_id = ?').bind(id).first<any>();
    if (!linked) fail(409, 'not_linked');
    const temp = temporaryPassword();
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET pw_hash = ? WHERE id = ?').bind(await hashPassword(temp), linked.id),
      env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(linked.id),
    ]);
    await audit(env, user, 'member.password_reset', `member:${id}`, 'temporary password issued, sessions ended');
    return json({ temporaryPassword: temp, email: linked.email });
  }

  if ((m = path.match(/^\/api\/members\/(\d+)\/savings$/))) {
    const id = Number(m[1]);
    if (method === 'GET') {
      if (user.role === 'member' && user.member_id !== id) fail(403, 'not_yours');
      const ledger = await savingsLedger(env, id);
      return json({ ledger, balance: ledger.length ? ledger[ledger.length - 1].balance : 0 });
    }
    requireOffice(user);
    if (method === 'POST') {
      const member = await env.DB.prepare('SELECT id, status FROM members WHERE id = ?').bind(id).first<any>();
      if (!member) fail(404, 'not_found');
      if (member.status !== 'active') fail(409, 'member_inactive');
      const b = await readJson(req);
      const kind = b.kind;
      if (kind !== 'deposit' && kind !== 'withdrawal' && kind !== 'interest') fail(422, 'invalid', { field: 'kind' });
      const date = dateIn(b.date, 'date', todayAd());
      const note = str(b.note, 200, 'note');
      if (kind === 'interest') {
        const months = intIn(b.months, 'months', 1, 12);
        const cfg = await settings(env);
        const bal = await savingsBalanceOf(env, id);
        const amount = Math.round((bal * cfg.savings_rate_bp * months) / (10000 * 12));
        if (amount <= 0) fail(422, 'nothing_to_credit');
        await env.DB.prepare(`INSERT INTO savings_txn (member_id, kind, amount, txn_ad, txn_bs, note, created_by, created_at) VALUES (?, 'interest', ?, ?, ?, ?, ?, ?)`)
          .bind(id, amount, date, bsOf(date), note || `Interest for ${months} month(s) at ${cfg.savings_rate_bp / 100}%`, user.id, now()).run();
        await audit(env, user, 'savings.interest', `member:${id}`, `${amount} paisa for ${months} months`);
        return json({ ok: true, balance: await savingsBalanceOf(env, id) }, 201);
      }
      const amount = amountIn(b.amount, 'amount');
      if (kind === 'deposit') {
        await env.DB.prepare(`INSERT INTO savings_txn (member_id, kind, amount, txn_ad, txn_bs, note, created_by, created_at) VALUES (?, 'deposit', ?, ?, ?, ?, ?, ?)`)
          .bind(id, amount, date, bsOf(date), note, user.id, now()).run();
      } else {
        const r = await env.DB.prepare(
          `INSERT INTO savings_txn (member_id, kind, amount, txn_ad, txn_bs, note, created_by, created_at)
           SELECT ?, 'withdrawal', ?, ?, ?, ?, ?, ? WHERE (SELECT COALESCE(SUM(CASE WHEN kind = 'withdrawal' THEN -amount ELSE amount END), 0) FROM savings_txn WHERE member_id = ?) >= ?`,
        ).bind(id, amount, date, bsOf(date), note, user.id, now(), id, amount).run();
        if (!r.meta.changes) fail(422, 'insufficient_balance', { balance: await savingsBalanceOf(env, id) });
      }
      await audit(env, user, `savings.${kind}`, `member:${id}`, `${amount} paisa`);
      return json({ ok: true, balance: await savingsBalanceOf(env, id) }, 201);
    }
  }

  if (path === '/api/loans') {
    if (method === 'GET') {
      const status = url.searchParams.get('status') || 'all';
      const memberFilter = url.searchParams.get('member_id');
      if (user.role === 'member') {
        if (memberFilter !== String(user.member_id)) fail(403, 'not_yours');
      } else requireOffice(user);
      const binds: unknown[] = [];
      let where = 'WHERE 1=1';
      if (status === 'active' || status === 'closed') { where += ' AND l.status = ?'; binds.push(status); }
      if (memberFilter) { where += ' AND l.member_id = ?'; binds.push(Number(memberFilter)); }
      const rows = await env.DB.prepare(`SELECT l.id FROM loans l ${where} ORDER BY l.id DESC LIMIT 300`).bind(...binds).all<{ id: number }>();
      const out = [];
      for (const { id } of rows.results) {
        const v = await loanView(env, id);
        if (v) out.push({ id: v.id, memberId: v.memberId, memberName: v.memberName, memberNo: v.memberNo, principal: v.principal, annualRatePct: v.annualRatePct, termMonths: v.termMonths, emi: v.emi, status: v.status, purpose: v.purpose, disbursedAd: v.disbursedAd, disbursedBs: v.disbursedBs, isDemo: v.isDemo, summary: v.summary });
      }
      return json({ loans: out });
    }
    requireOffice(user);
    if (method === 'POST') {
      const b = await readJson(req);
      const memberId = intIn(b.member_id, 'member_id', 1, 1e9);
      const member = await env.DB.prepare('SELECT id, status, is_demo FROM members WHERE id = ?').bind(memberId).first<any>();
      if (!member) fail(404, 'not_found');
      if (member.status !== 'active') fail(409, 'member_inactive');
      const active = await env.DB.prepare(`SELECT COUNT(*) AS n FROM loans WHERE member_id = ? AND status = 'active'`).bind(memberId).first<{ n: number }>();
      if (Number(active?.n ?? 0) > 0) fail(409, 'active_loan_exists');
      const principal = amountIn(b.principal, 'principal');
      const cfg = await settings(env);
      const balance = await savingsBalanceOf(env, memberId);
      const limit = loanLimit(balance, cfg.loan_multiplier);
      if (principal > limit) fail(422, 'exceeds_limit', { limit, savings_balance: balance, multiplier: cfg.loan_multiplier });
      const termMonths = intIn(b.term_months, 'term_months', 1, 120);
      const method2 = b.method === 'flat' ? 'flat' : b.method === 'reducing' ? 'reducing' : null;
      if (!method2) fail(422, 'invalid', { field: 'method', reason: 'reducing or flat' });
      const ratePct = b.annual_rate_pct !== undefined ? pctIn(b.annual_rate_pct, 'annual_rate_pct', 36) : cfg.loan_rate_bp;
      const disbursedAd = dateIn(b.disbursed_ad, 'disbursed_ad', todayAd());
      const firstDue = dateIn(b.first_due_ad, 'first_due_ad', addMonthsIso(disbursedAd, 1));
      if (firstDue < disbursedAd) fail(422, 'invalid', { field: 'first_due_ad', reason: 'on or after disbursement' });
      const purpose = str(b.purpose, 200, 'purpose', { required: true });
      const loanId = await createLoan(env, { memberId, principal, annualBp: ratePct, termMonths, method: method2, purpose, disbursedAd, firstDueAd: firstDue, isDemo: member.is_demo ? 1 : 0, actor: user });
      await audit(env, user, 'loan.disbursed', `loan:${loanId}`, `member ${memberId}, ${principal} paisa, ${termMonths} months`);
      return json(await loanView(env, loanId), 201);
    }
  }

  if ((m = path.match(/^\/api\/loans\/(\d+)$/)) && method === 'GET') {
    const id = Number(m[1]);
    const v = await loanView(env, id);
    if (!v) fail(404, 'not_found');
    if (user.role === 'member' && user.member_id !== v!.memberId) fail(403, 'not_yours');
    return json(v);
  }

  if ((m = path.match(/^\/api\/loans\/(\d+)\/payments$/)) && method === 'POST') {
    requireOffice(user);
    const id = Number(m[1]);
    const b = await readJson(req);
    const amount = amountIn(b.amount, 'amount');
    const paidAd = dateIn(b.paid_ad, 'paid_ad', todayAd());
    const note = str(b.note, 200, 'note');
    const v = await recordPayment(env, id, amount, paidAd, note, user);
    await audit(env, user, 'loan.payment', `loan:${id}`, `${amount} paisa`);
    return json(v, 201);
  }

  if (path === '/api/cashbook' && method === 'GET') {
    requireOffice(user);
    const today = todayAd();
    const from = dateIn(url.searchParams.get('from') || undefined, 'from', addMonthsIso(today, -1));
    const to = dateIn(url.searchParams.get('to') || undefined, 'to', today);
    if (from > to) fail(422, 'invalid', { field: 'from', reason: 'from is after to' });
    return json(await cashbook(env, from, to));
  }

  if ((m = path.match(/^\/api\/members\/(\d+)\/statement$/)) && method === 'GET') {
    const id = Number(m[1]);
    if (user.role === 'member' && user.member_id !== id) fail(403, 'not_yours');
    return json(await statement(env, id));
  }

  if (path === '/api/audit' && method === 'GET') {
    requireOffice(user);
    const rows = await env.DB.prepare('SELECT id, actor_email, action, target, detail, created_at FROM audit_log ORDER BY id DESC LIMIT 200').all<any>();
    return json({ entries: rows.results });
  }

  if (path === '/api/staff') {
    requireOffice(user);
    if (method === 'GET') {
      const rows = await env.DB.prepare(`SELECT id, email, name, is_demo FROM users WHERE role = 'office' AND disabled = 0 ORDER BY id`).all<any>();
      return json({ staff: rows.results.map((r) => ({ ...r, is_demo: !!r.is_demo })) });
    }
    if (method === 'POST') {
      const b = await readJson(req);
      const name = str(b.name, 120, 'name', { required: true });
      const email = str(b.email, 190, 'email', { required: true }).toLowerCase();
      if (!validEmail(email)) fail(422, 'invalid', { field: 'email', reason: 'a valid email address' });
      const password = passwordIn(b.password);
      if (await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()) fail(409, 'email_taken');
      const r = await env.DB.prepare(`INSERT INTO users (email, name, pw_hash, role, member_id, is_demo, disabled, created_at) VALUES (?, ?, ?, 'office', NULL, 0, 0, ?)`)
        .bind(email, name, await hashPassword(password), now()).run();
      await audit(env, user, 'staff.added', `user:${r.meta.last_row_id}`, email);
      return json({ ok: true, id: Number(r.meta.last_row_id) }, 201);
    }
  }

  if (path === '/api/demo/reset' && method === 'POST') {
    requireOffice(user);
    if (!user.is_demo) fail(403, 'demo_only');
    await seedDemo(env, true);
    return json({ ok: true });
  }

  fail(404, 'no_route');
}

function publicUser(u: any) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, memberId: u.member_id ?? null, isDemo: !!u.is_demo };
}

async function settingsView(env: Env) {
  const s = await settings(env);
  return {
    name: s.name,
    reg_no: s.reg_no,
    address: s.address,
    phone: s.phone,
    savings_rate_pct: s.savings_rate_bp / 100,
    loan_rate_pct: s.loan_rate_bp / 100,
    loan_multiplier: s.loan_multiplier,
  };
}

let readyPromise: Promise<void> | null = null;
function ensureReady(env: Env): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      await env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s)));
      await seedDemo(env);
    })().catch((e) => {
      readyPromise = null;
      throw e;
    });
  }
  return readyPromise;
}

export async function handleRequest(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, env);
    let res = await env.ASSETS.fetch(req);
    if (res.status === 404 && !url.pathname.slice(url.pathname.lastIndexOf('/') + 1).includes('.')) {
      res = await env.ASSETS.fetch(new Request(new URL('/app-shell.html', url), req));
    }
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
    if (url.pathname.startsWith('/assets/')) headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    else headers.set('Cache-Control', 'no-cache');
    return new Response(res.body, { status: res.status, headers });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.code, ...e.extra }, e.status);
    console.error('unhandled', e instanceof Error ? e.message : 'error');
    return json({ error: 'server_error' }, 500);
  }
}

export { handleApi, ensureReady };

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    return handleRequest(req, env);
  },
};
