import { useMemo, useState } from 'react';
import { Link } from '../lib/router';
import { useAuth } from '../lib/auth';
import { post } from '../lib/api';
import { buildSchedule } from '../../shared/money.ts';
import { rs } from '../lib/format';
import { Button, Demo } from '../components/ui';

export function Landing() {
  const { user } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const demo = async (role: 'office' | 'member') => {
    setBusy(role);
    setErr(null);
    try {
      await post('/api/auth/demo', { role });
      window.location.href = role === 'office' ? '/office' : '/passbook';
    } catch {
      setErr('The demo is not ready yet. Try again in a moment.');
      setBusy(null);
    }
  };
  // Worked example: the same arithmetic the office screens use.
  const example = useMemo(() => buildSchedule(10000000, 1200, 12, 'reducing', '2027-01-15'), []);
  const flat = useMemo(() => buildSchedule(10000000, 1200, 12, 'flat', '2027-01-15'), []);

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-[72rem] items-center justify-between px-5 py-5 md:px-10">
        <Link to="/" className="display text-[1.7rem] leading-none">Sahakari <span className="nep text-base text-muted">सहकारी</span></Link>
        <nav className="flex items-center gap-1 text-sm font-semibold">
          <Link to="/terms" className="btn btn-quiet hidden sm:inline-flex">Terms</Link>
          <Link to="/privacy" className="btn btn-quiet hidden sm:inline-flex">Privacy</Link>
          {user ? (
            <Link to={user.role === 'office' ? '/office' : '/passbook'} className="btn btn-ghost">Open my ledger</Link>
          ) : (
            <Link to="/sign-in" className="btn btn-ghost">Sign in</Link>
          )}
        </nav>
      </header>

      <section className="mx-auto grid max-w-[72rem] gap-10 px-5 pb-16 pt-6 md:grid-cols-[1.15fr_0.85fr] md:gap-16 md:px-10 md:pb-24 md:pt-14">
        <div className="rise">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">For savings and loan cooperatives in Nepal</p>
          <h1 className="display mt-4 text-[2.7rem] leading-[1.02] md:text-[4.1rem]">
            The cooperative's books, kept in order.
          </h1>
          <p className="mt-6 max-w-[34rem] text-[1.08rem] leading-relaxed text-ink/85">
            Members and nominees, savings deposits and withdrawals, loan schedules with interest worked out line by line,
            repayments applied to the oldest installment first, passbook statements for members, and a cash book that keeps
            cash received apart from book entries such as interest.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button onClick={() => demo('office')} busy={busy === 'office'} disabled={!!busy}>Open the demo office</Button>
            <Button variant="ghost" onClick={() => demo('member')} busy={busy === 'member'} disabled={!!busy}>See a member passbook</Button>
          </div>
          <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted">
            <Demo /> The demo uses invented members and transactions, and you can reset it at any time.
          </p>
          {err ? <p role="alert" className="mt-3 text-sm font-semibold text-danger">{err}</p> : null}
          <p className="mt-6 text-sm text-muted">
            Members who already have a membership code from their cooperative can{' '}
            <Link to="/register" className="font-semibold text-primary underline underline-offset-4">create a login</Link>.
          </p>
        </div>

        <aside className="rise rise-3 self-start border-t-2 border-primary bg-surface p-6 md:mt-10" aria-labelledby="example-title">
          <p id="example-title" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Worked example</p>
          <p className="display mt-2 text-xl leading-snug">A loan of {rs(10000000)} at 12% a year, 12 months</p>
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 text-[0.95rem]">
            <div><dt className="text-muted">Reducing balance EMI</dt><dd className="num display text-2xl">{rs(example.emi)}</dd></div>
            <div><dt className="text-muted">Total interest</dt><dd className="num display text-2xl">{rs(example.totalInterest)}</dd></div>
            <div><dt className="text-muted">Flat rate EMI</dt><dd className="num display text-2xl">{rs(flat.emi)}</dd></div>
            <div><dt className="text-muted">Flat total interest</dt><dd className="num display text-2xl">{rs(flat.totalInterest)}</dd></div>
          </dl>
          <p className="mt-5 border-t border-line pt-4 text-sm text-muted">
            Worked out by the same arithmetic the office uses, to the paisa. The last installment absorbs any rounding, so the schedule closes at zero.
          </p>
        </aside>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-[72rem] gap-0 px-5 py-12 md:grid-cols-2 md:gap-14 md:px-10">
          <div>
            <h2 className="display text-3xl">What it keeps</h2>
            <ol className="ruled mt-6 text-[0.98rem]">
              {[
                ['Members', 'Member number, a code members use to make their own login, nominee, joining date in Bikram Sambat and in AD.'],
                ['Savings', 'Deposits, withdrawals that cannot take an account below zero, and interest posted for a number of months at the cooperative rate.'],
                ['Loans', 'The loan limit is your savings balance times a multiplier you set. One active loan per member. Reducing balance or flat, to the paisa.'],
                ['Repayments', 'Each payment clears installments oldest first. Installments past their date show as overdue, with the amount.'],
                ['Cash book', 'Cash in and out, kept apart from book entries. Filter by date. Totals always match the rows.'],
                ['Audit trail', 'Every entry, rate change, password reset and staff addition is logged with who did it and when.'],
              ].map(([t, d]) => (
                <li key={t} className="grid grid-cols-[7.5rem_1fr] gap-4 py-3.5">
                  <span className="font-semibold">{t}</span>
                  <span className="text-muted">{d}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="mt-10 md:mt-0">
            <h2 className="display text-3xl">What it does not do</h2>
            <ul className="mt-6 space-y-4 text-[0.98rem] text-ink/85">
              <li>It takes no online payments. Cash and a manual ledger are the only money it records.</li>
              <li>It does not send SMS, WhatsApp or email to members. No messaging provider is connected.</li>
              <li>It does not set your rates, penalties or limits for you. Your bylaws decide those, and the settings are yours to change.</li>
              <li>It is not a substitute for your registration, audit or regulatory filings with the cooperative authorities.</li>
            </ul>
            <p className="mt-8 text-sm text-muted">
              Read the <Link to="/terms" className="font-semibold text-primary underline underline-offset-4">terms</Link> and the{' '}
              <Link to="/privacy" className="font-semibold text-primary underline underline-offset-4">privacy notice</Link>.
            </p>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-[72rem] flex-wrap items-center justify-between gap-3 px-5 py-8 text-sm text-muted md:px-10">
        <span>Sahakari · cooperative ledger · Dates in Bikram Sambat with AD beside them</span>
        <span className="flex gap-4">
          <Link to="/terms" className="hover:text-ink">Terms</Link>
          <Link to="/privacy" className="hover:text-ink">Privacy</Link>
        </span>
      </footer>
    </div>
  );
}
