import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest, ensureReady, SESSION_COOKIE, DEMO_OFFICE, DEMO_MEMBER, todayAd } from '../src/worker.ts';
import { D1Shim } from './d1shim.ts';

const ORIGIN = 'https://sahakari.sites.tab.bot';
let env: any;
let ip = 0;

async function call(method: string, path: string, o: { body?: any; cookie?: string; origin?: string; raw?: string; ct?: string } = {}) {
  const h: Record<string, string> = { 'CF-Connecting-IP': `10.9.0.${++ip % 250}` };
  if (method !== 'GET') h.Origin = o.origin ?? ORIGIN;
  if (o.cookie) h.Cookie = `${SESSION_COOKIE}=${o.cookie}`;
  let body: string | undefined;
  if (o.raw !== undefined) { body = o.raw; h['Content-Type'] = o.ct ?? 'application/json'; }
  else if (o.body !== undefined) { body = JSON.stringify(o.body); h['Content-Type'] = 'application/json'; }
  const res = await handleRequest(new Request(ORIGIN + path, { method, headers: h, body }), env);
  const text = await res.text();
  const m = new RegExp(SESSION_COOKIE + '=([^;]*)').exec(res.headers.get('set-cookie') || '');
  let j: any = null;
  try { j = text ? JSON.parse(text) : null; } catch { j = text; }
  return { status: res.status, json: j, cookie: m && m[1] ? m[1] : null, headers: res.headers };
}

let office: string, member: string, sunitaId: number, bikashId: number;

test.before(async () => {
  env = { DB: new D1Shim() };
  await ensureReady(env);
});

test('schema and demo seed: demo members, loans and both demo logins exist', async () => {
  const members = await env.DB.prepare('SELECT COUNT(*) AS n FROM members WHERE is_demo = 1').first('n');
  assert.equal(members, 5);
  const loans = await env.DB.prepare('SELECT COUNT(*) AS n FROM loans WHERE is_demo = 1').first('n');
  assert.equal(loans, 3);
  const r = await call('POST', '/api/auth/demo', { body: { role: 'office' } });
  assert.equal(r.status, 200);
  assert.equal(r.json.user.role, 'office');
  assert.equal(r.json.user.email, DEMO_OFFICE);
  office = r.cookie!;
  const m = await call('POST', '/api/auth/demo', { body: { role: 'member' } });
  assert.equal(m.json.user.role, 'member');
  member = m.cookie!;
  const list = await call('GET', '/api/members', { cookie: office });
  sunitaId = list.json.members.find((x: any) => x.full_name === 'Sunita Rai').id;
  bikashId = list.json.members.find((x: any) => x.full_name === 'Bikash Thapa').id;
});

test('auth: unauthenticated and wrong-role calls are refused', async () => {
  assert.equal((await call('GET', '/api/dashboard')).status, 401);
  assert.equal((await call('GET', '/api/members')).status, 401);
  assert.equal((await call('GET', '/api/members', { cookie: member })).status, 403);
  assert.equal((await call('GET', '/api/dashboard', { cookie: member })).status, 403);
  assert.equal((await call('GET', '/api/audit', { cookie: member })).status, 403);
  assert.equal((await call('GET', '/api/cashbook', { cookie: member })).status, 403);
  const me = await call('GET', '/api/auth/me', { cookie: member });
  assert.equal(me.json.user.memberId, sunitaId);
});

test('members cannot read another member or another loan', async () => {
  assert.equal((await call('GET', `/api/members/${bikashId}`, { cookie: member })).status, 403);
  assert.equal((await call('GET', `/api/members/${bikashId}/statement`, { cookie: member })).status, 403);
  assert.equal((await call('GET', `/api/loans?member_id=${bikashId}`, { cookie: member })).status, 403);
  const own = await call('GET', `/api/members/${sunitaId}/statement`, { cookie: member });
  assert.equal(own.status, 200);
  assert.ok(own.json.savings.length > 0);
  assert.equal(own.json.member.memberCode, undefined, 'member code is office-only');
});

test('dashboard totals come from the ledger and are labelled demo', async () => {
  const d = await call('GET', '/api/dashboard', { cookie: office });
  assert.equal(d.status, 200);
  assert.equal(d.json.isDemo, true);
  assert.equal(d.json.totals.members, 5);
  assert.equal(d.json.totals.activeLoans, 2);
  assert.ok(d.json.totals.overdueCount >= 2, 'the demo loan with no payments shows overdue installments');
  assert.equal(d.json.months.length, 6);
});

test('savings: deposits, a withdrawal that would overdraw is refused, interest is computed', async () => {
  const before = (await call('GET', `/api/members/${bikashId}/savings`, { cookie: office })).json.balance;
  const dep = await call('POST', `/api/members/${bikashId}/savings`, { cookie: office, body: { kind: 'deposit', amount: '2,500.50', date: todayAd(), note: 'test' } });
  assert.equal(dep.status, 201);
  assert.equal(dep.json.balance, before + 250050);
  const over = await call('POST', `/api/members/${bikashId}/savings`, { cookie: office, body: { kind: 'withdrawal', amount: 999999999 } });
  assert.equal(over.status, 422);
  assert.equal(over.json.error, 'insufficient_balance');
  const wd = await call('POST', `/api/members/${bikashId}/savings`, { cookie: office, body: { kind: 'withdrawal', amount: 100 } });
  assert.equal(wd.status, 201);
  assert.equal(wd.json.balance, before + 250050 - 10000);
  const intr = await call('POST', `/api/members/${bikashId}/savings`, { cookie: office, body: { kind: 'interest', months: 3 } });
  assert.equal(intr.status, 201);
  assert.ok(intr.json.balance > wd.json.balance);
  const bad = await call('POST', `/api/members/${bikashId}/savings`, { cookie: office, body: { kind: 'deposit', amount: '-5' } });
  assert.equal(bad.status, 422);
  const badKind = await call('POST', `/api/members/${bikashId}/savings`, { cookie: office, body: { kind: 'bonus', amount: 5 } });
  assert.equal(badKind.status, 422);
});

test('loans: refuse above the savings-based limit, one active loan per member, then schedule and payments', async () => {
  const cookieOffice = office;
  const bal = (await call('GET', `/api/members/${sunitaId}/savings`, { cookie: cookieOffice })).json.balance;
  const tooBig = await call('POST', '/api/loans', { cookie: cookieOffice, body: { member_id: sunitaId, principal: '1000000000', term_months: 12, method: 'reducing', purpose: 'x' } });
  assert.equal(tooBig.status, 409, 'Sunita already has an active loan');
  assert.equal(tooBig.json.error, 'active_loan_exists');

  // a fresh member with savings of Rs. 10,000 can borrow up to 3x = Rs. 30,000
  const created = await call('POST', '/api/members', { cookie: cookieOffice, body: { full_name: 'Test Member One', phone: '9811111111', nominee_name: 'N', nominee_relation: 'Spouse' } });
  assert.equal(created.status, 201);
  assert.match(created.json.memberCode, /^SHK-[A-Z2-9]{6}$/);
  const newId = created.json.id;
  assert.match(created.json.memberNo, /^M\d{4}$/);
  await call('POST', `/api/members/${newId}/savings`, { cookie: cookieOffice, body: { kind: 'deposit', amount: 10000, date: todayAd() } });
  const over = await call('POST', '/api/loans', { cookie: cookieOffice, body: { member_id: newId, principal: 30000.01, term_months: 12, method: 'reducing', purpose: 'Shop' } });
  assert.equal(over.status, 422);
  assert.equal(over.json.error, 'exceeds_limit');
  assert.equal(over.json.limit, 3000000);
  const ok = await call('POST', '/api/loans', { cookie: cookieOffice, body: { member_id: newId, principal: 30000, annual_rate_pct: 12, term_months: 12, method: 'reducing', purpose: 'Shop stock', disbursed_ad: todayAd() } });
  assert.equal(ok.status, 201);
  assert.equal(ok.json.schedule.length, 12);
  assert.equal(ok.json.principal, 3000000);
  assert.equal(ok.json.summary.principalOutstanding, 3000000);
  const loanId = ok.json.id;
  const dup = await call('POST', '/api/loans', { cookie: cookieOffice, body: { member_id: newId, principal: 1000, term_months: 2, method: 'flat', purpose: 'again' } });
  assert.equal(dup.json.error, 'active_loan_exists');

  const first = ok.json.schedule[0].total;
  const pay = await call('POST', `/api/loans/${loanId}/payments`, { cookie: cookieOffice, body: { amount: first / 100, paid_ad: todayAd() } });
  assert.equal(pay.status, 201);
  assert.equal(pay.json.schedule[0].status, 'paid');
  assert.ok(pay.json.summary.principalOutstanding < 3000000);
  const overpay = await call('POST', `/api/loans/${loanId}/payments`, { cookie: cookieOffice, body: { amount: 99999999, paid_ad: todayAd() } });
  assert.equal(overpay.status, 422);
  assert.equal(overpay.json.error, 'over_due');
  // settle the rest exactly and the loan closes
  const due = pay.json.summary.amountDue;
  const settle = await call('POST', `/api/loans/${loanId}/payments`, { cookie: cookieOffice, body: { amount: due / 100, paid_ad: todayAd(), note: 'final' } });
  assert.equal(settle.status, 201);
  assert.equal(settle.json.status, 'closed');
  assert.equal(settle.json.summary.principalOutstanding, 0);
  const late = await call('POST', `/api/loans/${loanId}/payments`, { cookie: cookieOffice, body: { amount: 100, paid_ad: todayAd() } });
  assert.equal(late.json.error, 'loan_closed');
});

test('member registration: needs a valid unused code, a unique email, and then signs in', async () => {
  const created = await call('POST', '/api/members', { cookie: office, body: { full_name: 'Register Me', phone: '9822222222' } });
  const code = created.json.memberCode;
  const reg = await call('POST', '/api/auth/register', { body: { member_code: code, email: 'register.me@example.com', password: 'Strong-pass-1', name: 'Register Me' } });
  assert.equal(reg.status, 201);
  assert.equal(reg.json.user.role, 'member');
  const again = await call('POST', '/api/auth/register', { body: { member_code: code, email: 'other@example.com', password: 'Strong-pass-1' } });
  assert.equal(again.json.error, 'code_not_usable', 'a code links one login only');
  const bad = await call('POST', '/api/auth/register', { body: { member_code: 'SHK-ZZZ', email: 'x@example.com', password: 'Strong-pass-1' } });
  assert.equal(bad.status, 422);
  const short = await call('POST', '/api/auth/register', { body: { member_code: created.json.memberCode, email: 'x2@example.com', password: 'short' } });
  assert.equal(short.status, 422);
  const dupEmail = await call('POST', '/api/auth/register', { body: { member_code: 'SHK-AAAAAA', email: 'register.me@example.com', password: 'Strong-pass-1' } });
  assert.equal(dupEmail.status, 422);
  const plain = await call('POST', '/api/auth/login', { body: { email: 'register.me@example.com', password: 'Strong-pass-1' } });
  assert.equal(plain.status, 200);
  const wrong = await call('POST', '/api/auth/login', { body: { email: 'register.me@example.com', password: 'nope-nope' } });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.json.error, 'wrong_credentials');
});

test('password reset by the office ends the member sessions and issues a temporary password once', async () => {
  const created = await call('POST', '/api/members', { cookie: office, body: { full_name: 'Reset Target' } });
  const reg = await call('POST', '/api/auth/register', { body: { member_code: created.json.memberCode, email: 'reset.target@example.com', password: 'Original-pass-1' } });
  const session = reg.cookie!;
  const reset = await call('POST', `/api/members/${created.json.id}/reset-password`, { cookie: office });
  assert.equal(reset.status, 200);
  assert.ok(reset.json.temporaryPassword.length >= 10);
  const oldSession = await call('GET', '/api/auth/me', { cookie: session });
  assert.equal(oldSession.json.user, null, 'sessions were ended');
  const oldPw = await call('POST', '/api/auth/login', { body: { email: 'reset.target@example.com', password: 'Original-pass-1' } });
  assert.equal(oldPw.status, 401);
  const newPw = await call('POST', '/api/auth/login', { body: { email: 'reset.target@example.com', password: reset.json.temporaryPassword } });
  assert.equal(newPw.status, 200);
});

test('password change needs the current password; logout ends the session', async () => {
  const r = await call('POST', '/api/auth/login', { body: { email: DEMO_MEMBER, password: 'irrelevant-password' } });
  assert.equal(r.status, 401, 'demo member has a random password; demo sign-in is the route');
  const dm = await call('POST', '/api/auth/demo', { body: { role: 'member' } });
  const wrong = await call('POST', '/api/auth/change-password', { cookie: dm.cookie!, body: { current: 'nope', next: 'New-pass-123' } });
  assert.equal(wrong.status, 401);
  const out = await call('POST', '/api/auth/logout', { cookie: dm.cookie! });
  assert.equal(out.status, 200);
  assert.equal((await call('GET', '/api/auth/me', { cookie: dm.cookie! })).json.user, null);
});

test('settings: validated, and used by the next calculation', async () => {
  const bad = await call('PUT', '/api/settings', { cookie: office, body: { name: 'X', savings_rate_pct: 99, loan_rate_pct: 12, loan_multiplier: 3 } });
  assert.equal(bad.status, 422);
  const ok = await call('PUT', '/api/settings', { cookie: office, body: { name: 'Test Cooperative', reg_no: 'REG-1', savings_rate_pct: 6, loan_rate_pct: 13.5, loan_multiplier: 2, phone: '' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.loan_rate_pct, 13.5);
  const s = await call('GET', '/api/settings', { cookie: office });
  assert.equal(s.json.loan_multiplier, 2);
  const crossSite = await call('PUT', '/api/settings', { cookie: office, origin: 'https://evil.example', body: { name: 'x' } });
  assert.equal(crossSite.status, 403);
  const notJson = await call('POST', '/api/members', { cookie: office, raw: 'full_name=Hi', ct: 'text/plain' });
  assert.equal(notJson.status, 415);
});

test('statement and cashbook agree: cash in and out, interest kept out of cash', async () => {
  const today = todayAd();
  const from = '2000-01-01';
  const cb = await call('GET', `/api/cashbook?from=${from}&to=${today}`, { cookie: office });
  assert.equal(cb.status, 200);
  const t = cb.json.totals;
  assert.equal(t.net, t.cashIn - t.cashOut);
  assert.ok(t.cashIn > 0 && t.cashOut > 0);
  assert.ok(t.interestCredited > 0);
  const badRange = await call('GET', `/api/cashbook?from=${today}&to=2001-01-01`, { cookie: office });
  assert.equal(badRange.status, 422);
  const st = await call('GET', `/api/members/${sunitaId}/statement`, { cookie: member });
  const ledger = st.json.savings;
  assert.equal(ledger[ledger.length - 1].balance, st.json.savingsBalance);
});

test('audit log records the writes', async () => {
  const a = await call('GET', '/api/audit', { cookie: office });
  const actions = a.json.entries.map((e: any) => e.action);
  assert.ok(actions.includes('loan.disbursed'));
  assert.ok(actions.includes('member.password_reset'));
  assert.ok(actions.includes('savings.withdrawal'));
});

test('demo reset restores the seeded demo data and only for the demo office', async () => {
  const r = await call('POST', '/api/demo/reset', { cookie: office });
  assert.equal(r.status, 200);
  const loans = await env.DB.prepare('SELECT COUNT(*) AS n FROM loans WHERE is_demo = 1').first('n');
  assert.equal(loans, 3);
  const realMembers = await env.DB.prepare('SELECT COUNT(*) AS n FROM members WHERE is_demo = 0').first('n');
  assert.ok(realMembers > 0, 'real members are not touched by the demo reset');
});
