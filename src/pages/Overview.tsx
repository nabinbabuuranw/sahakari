import { useData } from '../lib/useData';
import { Link } from '../lib/router';
import { rs } from '../lib/format';
import { bsText, adText } from '../lib/format';
import { Chip, Demo, Empty, Notice, PageHead, Skeleton, Stat } from '../components/ui';
import { useAuth } from '../lib/auth';

interface Dash {
  coop: { name: string; regNo: string };
  isDemo: boolean;
  today: { ad: string; bs: string };
  totals: { members: number; activeMembers: number; savingsBalance: number; activeLoans: number; principalOutstanding: number; overdueAmount: number; overdueCount: number };
  overdueLoans: { id: number; memberName: string; memberNo: string; overdueAmount: number; overdueCount: number; purpose: string }[];
  months: { ym: string; label: string; cashIn: number; cashOut: number }[];
  recent: { date: string; kind: string; member: string; amount: number }[];
}

const KIND: Record<string, string> = { deposit: 'Deposit', withdrawal: 'Withdrawal', interest: 'Interest (book entry)' };

export function Overview() {
  const { data, error, loading, reload } = useData<Dash>('/api/dashboard');
  const { user } = useAuth();
  if (error) return <Notice tone="error">{error} <button className="btn btn-quiet" onClick={reload}>Try again</button></Notice>;
  if (!data) return <div aria-busy="true" aria-label="Loading overview" className="space-y-8"><Skeleton lines={6} /></div>;
  const max = Math.max(1, ...data.months.flatMap((m) => [m.cashIn, m.cashOut]));
  return (
    <div className="space-y-10">
      <PageHead kicker={data.coop.name} title={`Good day, ${user?.name?.split(' ')[0] ?? ''}`}>
        <span className="flex items-center gap-2 text-sm text-muted">
          {data.isDemo ? <Demo /> : null}
          <span>Today {bsText(data.today.ad)}</span>
          <span className="text-line">|</span>
          <span className="num">{adText(data.today.ad)}</span>
        </span>
      </PageHead>

      <section aria-label="Totals" className="rise rise-2 grid grid-cols-2 gap-y-6 border-b border-line pb-8 md:grid-cols-4 md:divide-x md:divide-line">
        <Stat label="Members" value={data.totals.members} sub={`${data.totals.activeMembers} active`} />
        <Stat label="Savings held" value={rs(data.totals.savingsBalance)} sub="Deposits less withdrawals, plus interest" />
        <Stat label="Loans outstanding" value={rs(data.totals.principalOutstanding)} sub={`${data.totals.activeLoans} active loan${data.totals.activeLoans === 1 ? '' : 's'}`} />
        <Stat label="Overdue" value={rs(data.totals.overdueAmount)} tone={data.totals.overdueCount ? 'danger' : undefined} sub={data.totals.overdueCount ? `${data.totals.overdueCount} installment${data.totals.overdueCount === 1 ? '' : 's'} past due` : 'Nothing past due'} />
      </section>

      <div className="grid gap-10 md:grid-cols-[1.1fr_0.9fr]">
        <section aria-labelledby="cash-h" className="rise rise-3">
          <h2 id="cash-h" className="display text-2xl">Cash in and out, six months</h2>
          <p className="mt-1 text-sm text-muted">Cash in is deposits and loan repayments. Cash out is withdrawals and loans paid out. Interest is not cash.</p>
          <div className="mt-6 flex h-56 items-end gap-3 border-b border-line pb-0 md:gap-5" role="img" aria-label="Bar chart of cash in and out for the last six months">
            {data.months.map((m, i) => (
              <div key={m.ym} className="flex h-full flex-1 flex-col justify-end">
                <div className="flex h-[85%] items-end justify-center gap-1">
                  <div className="bar w-1/2 max-w-[1.4rem] rounded-t-sm bg-primary" style={{ height: `${(m.cashIn / max) * 100}%`, animationDelay: `${i * 60}ms` }} title={`Cash in ${rs(m.cashIn)}`} />
                  <div className="bar w-1/2 max-w-[1.4rem] rounded-t-sm bg-accent" style={{ height: `${(m.cashOut / max) * 100}%`, animationDelay: `${i * 60 + 40}ms` }} title={`Cash out ${rs(m.cashOut)}`} />
                </div>
                <p className="mt-2 text-center text-[0.72rem] leading-tight text-muted">{m.label.split(' ')[0]}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-5 text-sm text-muted">
            <span className="flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 bg-primary" aria-hidden="true" />Cash in</span>
            <span className="flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 bg-accent" aria-hidden="true" />Cash out</span>
          </div>
          <div className="mt-6">
            <p className="text-sm font-semibold">Net cash, by month</p>
            <ul className="ruled mt-2 text-sm">
              {data.months.map((m) => (
                <li key={m.ym} className="flex items-baseline justify-between gap-4 py-2">
                  <span className="whitespace-nowrap text-muted">{m.label}</span>
                  <span className={`num whitespace-nowrap font-semibold ${m.cashIn - m.cashOut < 0 ? 'text-danger' : ''}`}>{rs(m.cashIn - m.cashOut)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="od-h" className="rise rise-3">
          <div className="flex items-baseline justify-between">
            <h2 id="od-h" className="display text-2xl">Loans with overdue installments</h2>
            <Link to="/loans" className="text-sm font-semibold text-primary underline underline-offset-4">All loans</Link>
          </div>
          {data.overdueLoans.length === 0 ? (
            <div className="mt-4"><Empty title="Nothing overdue">Every active loan is on schedule.</Empty></div>
          ) : (
            <ul className="ruled mt-4">
              {data.overdueLoans.map((l) => (
                <li key={l.id}>
                  <Link to={`/loans/${l.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3.5 hover:text-primary">
                    <span>
                      <span className="block font-semibold">{l.memberName}</span>
                      <span className="block text-sm text-muted">{l.purpose} · {l.memberNo}</span>
                    </span>
                    <span className="text-right">
                      <span className="num block font-semibold text-danger">{rs(l.overdueAmount)}</span>
                      <Chip tone="overdue">{l.overdueCount} overdue</Chip>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-10 flex items-baseline justify-between">
            <h2 className="display text-2xl">Latest entries</h2>
            <Link to="/cashbook" className="text-sm font-semibold text-primary underline underline-offset-4">Cash book</Link>
          </div>
          {data.recent.length === 0 ? <div className="mt-4"><Empty title="No entries yet" /></div> : (
            <ul className="ruled mt-4 text-[0.95rem]">
              {data.recent.map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-3">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{r.member}</span>
                    <span className="block text-sm text-muted">{KIND[r.kind] ?? r.kind} · {adText(r.date)}</span>
                  </span>
                  <span className="num shrink-0 font-semibold">{rs(r.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {loading ? <span className="sr-only">Refreshing</span> : null}
    </div>
  );
}
