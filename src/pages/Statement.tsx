import { useData } from '../lib/useData';
import { useAuth } from '../lib/auth';
import { rs, adText, bsText } from '../lib/format';
import { Button, Chip, Demo, Empty, Notice, PageHead, Skeleton } from '../components/ui';
import { IconPrint } from '../components/Icons';
import { Link } from '../lib/router';

interface Statement {
  coop: { name: string; regNo: string; address: string; phone: string };
  generatedAd: string; generatedBs: string;
  member: { id: number; memberNo: string; fullName: string; phone: string; joinedAd: string; joinedBs: string; status: string; isDemo: boolean; savingsBalance: number };
  savings: { id: number; kind: string; amount: number; dateAd: string; dateBs: string; note: string; balance: number }[];
  loans: { id: number; principal: number; annualRatePct: number; termMonths: number; method: string; emi: number; totalPayable: number; purpose: string; disbursedAd: string; disbursedBs: string; status: string; summary: { paidTotal: number; principalOutstanding: number; amountDue: number; overdueAmount: number; overdueCount: number } }[];
  isDemo: boolean;
}

const KIND: Record<string, string> = { deposit: 'Deposit', withdrawal: 'Withdrawal', interest: 'Interest' };

/** The passbook: savings ledger with running balance and every loan's status. Members see their own; the office opens it from a member's page. */
export function Statement({ memberId }: { memberId?: number }) {
  const { user } = useAuth();
  const id = memberId ?? user?.memberId ?? null;
  const { data, error, reload } = useData<Statement>(id ? `/api/members/${id}/statement` : null);
  if (!id) return <Notice tone="error">This account is not linked to a member yet. Ask the cooperative office.</Notice>;
  if (error) return <Notice tone="error">{error} <button className="btn btn-quiet" onClick={reload}>Try again</button></Notice>;
  if (!data) return <div aria-busy="true" aria-label="Loading passbook"><Skeleton lines={8} /></div>;
  const m = data.member;
  const isOffice = user?.role === 'office';
  return (
    <div className="space-y-10">
      <div className="no-print">
        <PageHead kicker={`Passbook · ${m.memberNo}`} title={m.fullName}>
          {data.isDemo ? <Demo /> : null}
          {isOffice ? <Link to={`/members/${m.id}`} className="btn btn-ghost">Back to member</Link> : null}
          <Button variant="ghost" onClick={() => window.print()}><IconPrint /> Print</Button>
        </PageHead>
      </div>

      <div className="print-area">
        <header className="hidden print:block">
          <h1 className="display text-3xl">{data.coop.name}</h1>
          <p>Passbook of {m.fullName} ({m.memberNo}) · Printed {bsText(data.generatedAd)}</p>
        </header>

        <section aria-label="Summary" className="rise rise-2 grid grid-cols-2 gap-y-6 border-b border-line pb-8 md:grid-cols-3">
          <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Savings balance</p><p className="display num mt-1 text-[1.5rem] md:text-[2rem]">{rs(m.savingsBalance)}</p></div>
          <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Loans outstanding</p><p className="display num mt-1 text-[1.5rem] md:text-[2rem]">{rs(data.loans.filter((l) => l.status === 'active').reduce((s, l) => s + l.summary.principalOutstanding, 0))}</p></div>
          <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Overdue</p><p className={`display num mt-1 text-[1.5rem] md:text-[2rem] ${data.loans.some((l) => l.summary.overdueAmount > 0) ? 'text-danger' : ''}`}>{rs(data.loans.reduce((s, l) => s + l.summary.overdueAmount, 0))}</p></div>
        </section>

        <section aria-labelledby="pb-savings" className="rise rise-3 mt-10">
          <h2 id="pb-savings" className="display text-2xl">Savings</h2>
          {data.savings.length === 0 ? <div className="mt-4"><Empty title="No entries yet" /></div> : (
            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[34rem] border-collapse text-[0.95rem]">
                <caption className="sr-only">Savings entries with running balance, oldest first</caption>
                <thead>
                  <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                    <th scope="col" className="py-2.5 pr-3 font-semibold">Date</th>
                    <th scope="col" className="py-2.5 pr-3 font-semibold">Entry</th>
                    <th scope="col" className="py-2.5 pr-3 font-semibold">Note</th>
                    <th scope="col" className="py-2.5 pr-3 text-right font-semibold">Amount</th>
                    <th scope="col" className="py-2.5 text-right font-semibold">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {data.savings.map((r) => (
                    <tr key={r.id} className="border-b border-line">
                      <td className="py-3 pr-3 align-top"><span className="block">{bsText(r.dateAd)}</span><span className="text-sm text-muted">{adText(r.dateAd)}</span></td>
                      <td className="py-3 pr-3 align-top">{KIND[r.kind] ?? r.kind}</td>
                      <td className="py-3 pr-3 align-top text-muted">{r.note || '—'}</td>
                      <td className={`num py-3 pr-3 text-right align-top ${r.kind === 'withdrawal' ? 'text-danger' : ''}`}>{r.kind === 'withdrawal' ? '−' : '+'}{rs(r.amount)}</td>
                      <td className="num py-3 text-right align-top font-semibold">{rs(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.savings.length > 0 ? (
            <ul className="ruled mt-4 md:hidden" aria-label="Savings entries with running balance, oldest first">
              {data.savings.map((r) => (
                <li key={r.id} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 py-3.5 text-[0.95rem]">
                  <span className="font-semibold">{KIND[r.kind] ?? r.kind}</span>
                  <span className={`num text-right font-semibold ${r.kind === 'withdrawal' ? 'text-danger' : ''}`}>{r.kind === 'withdrawal' ? '−' : '+'}{rs(r.amount)}</span>
                  <span className="text-sm text-muted">{bsText(r.dateAd)} · {adText(r.dateAd)}{r.note ? ` · ${r.note}` : ''}</span>
                  <span className="num text-right text-sm text-muted">Bal. {rs(r.balance)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section aria-labelledby="pb-loans" className="rise rise-3 mt-12">
          <h2 id="pb-loans" className="display text-2xl">Loans</h2>
          {data.loans.length === 0 ? <div className="mt-4"><Empty title="No loans">Nothing borrowed on this account.</Empty></div> : (
            <ul className="ruled mt-4">
              {data.loans.map((l) => (
                <li key={l.id} className="py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link to={user?.role === 'office' ? `/loans/${l.id}` : `/passbook/loans/${l.id}`} className="display text-xl hover:text-primary">{l.purpose}</Link>
                    {l.status === 'closed' ? <Chip tone="paid">Closed</Chip> : l.summary.overdueCount ? <Chip tone="overdue">{l.summary.overdueCount} overdue</Chip> : <Chip tone="open">On schedule</Chip>}
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    Taken {bsText(l.disbursedAd)} · {rs(l.principal)} at {(l.annualRatePct).toFixed(l.annualRatePct % 1 ? 2 : 0)}% · {l.termMonths} months · {l.method === 'flat' ? 'flat rate' : 'reducing balance'}
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
                    <div><dt className="text-muted">Monthly installment</dt><dd className="num font-semibold">{rs(l.emi)}</dd></div>
                    <div><dt className="text-muted">Paid so far</dt><dd className="num font-semibold">{rs(l.summary.paidTotal)}</dd></div>
                    <div><dt className="text-muted">Principal left</dt><dd className="num font-semibold">{rs(l.summary.principalOutstanding)}</dd></div>
                    <div><dt className="text-muted">Due now</dt><dd className={`num font-semibold ${l.summary.overdueAmount ? 'text-danger' : ''}`}>{rs(l.summary.amountDue)}</dd></div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="mt-12 border-t border-line pt-5 text-sm text-muted">
          <p>{data.coop.name}{data.coop.regNo ? ` · Reg. ${data.coop.regNo}` : ''}{data.coop.phone ? ` · ${data.coop.phone}` : ''}</p>
          <p>Printed {bsText(data.generatedAd)} ({adText(data.generatedAd)}). Balances are as recorded in the cooperative ledger; report any difference to the office.</p>
        </footer>
      </div>
    </div>
  );
}
