import { useState } from 'react';
import { useData } from '../lib/useData';
import { rs, adText, bsText, today, addMonths } from '../lib/format';
import { Button, Empty, Field, PageHead, Skeleton, Stat, TextInput, Notice } from '../components/ui';

interface Cash {
  from: string; to: string;
  rows: { date: string; bs: string; kind: string; member: string; note: string; amount: number }[];
  totals: { cashIn: number; cashOut: number; net: number; interestCredited: number };
  note: string;
}
const KIND: Record<string, string> = { deposit: 'Deposit', withdrawal: 'Withdrawal', repayment: 'Loan repayment', disbursement: 'Loan paid out', interest: 'Interest (book)' };

export function Cashbook() {
  const [from, setFrom] = useState(addMonths(today(), -1));
  const [to, setTo] = useState(today());
  const [applied, setApplied] = useState({ from, to });
  const { data, error, reload } = useData<Cash>(`/api/cashbook?from=${applied.from}&to=${applied.to}`);
  return (
    <div className="space-y-8">
      <PageHead kicker="Ledger" title="Cash book" />
      <form className="rise rise-2 flex flex-col gap-4 md:flex-row md:items-end" onSubmit={(e) => { e.preventDefault(); if (from <= to) setApplied({ from, to }); }}>
        <div className="md:w-56"><Field label="From (AD)" htmlFor="cb-from"><TextInput id="cb-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field></div>
        <div className="md:w-56"><Field label="To (AD)" htmlFor="cb-to"><TextInput id="cb-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field></div>
        <Button type="submit" variant="ghost">Show entries</Button>
      </form>
      {from > to ? <Notice tone="error">The start date is after the end date.</Notice> : null}
      {error ? <Notice tone="error">{error} <button className="btn btn-quiet" onClick={reload}>Try again</button></Notice> : null}
      {!data && !error ? <div aria-busy="true"><Skeleton lines={6} /></div> : null}
      {data ? (
        <>
          <section aria-label="Totals" className="rise rise-2 grid grid-cols-2 gap-y-6 border-b border-line pb-8 md:grid-cols-4 md:divide-x md:divide-line">
            <Stat label="Cash in" value={rs(data.totals.cashIn)} sub="Deposits and repayments" />
            <Stat label="Cash out" value={rs(data.totals.cashOut)} sub="Withdrawals and loans paid out" />
            <Stat label="Net cash" value={rs(data.totals.net)} sub="In less out" />
            <Stat label="Interest credited" value={rs(data.totals.interestCredited)} sub="Book entry, not cash" />
          </section>
          {data.rows.length === 0 ? <Empty title="No entries in this period" /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] border-collapse text-[0.95rem]">
                <caption className="sr-only">Cash book entries, newest first</caption>
                <thead>
                  <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                    <th scope="col" className="py-2.5 pr-3 font-semibold">Date</th>
                    <th scope="col" className="py-2.5 pr-3 font-semibold">Entry</th>
                    <th scope="col" className="py-2.5 pr-3 font-semibold">Member</th>
                    <th scope="col" className="py-2.5 pr-3 font-semibold">Note</th>
                    <th scope="col" className="py-2.5 pr-3 text-right font-semibold">Cash in</th>
                    <th scope="col" className="py-2.5 text-right font-semibold">Cash out</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r, i) => {
                    const cashIn = r.kind === 'deposit' || r.kind === 'repayment';
                    const cashOut = r.kind === 'withdrawal' || r.kind === 'disbursement';
                    return (
                      <tr key={i} className="border-b border-line align-top">
                        <td className="py-3 pr-3"><span className="block">{bsText(r.date)}</span><span className="text-sm text-muted">{adText(r.date)}</span></td>
                        <td className="py-3 pr-3">{KIND[r.kind] ?? r.kind}</td>
                        <td className="py-3 pr-3">{r.member}</td>
                        <td className="py-3 pr-3 text-muted">{r.note || '—'}</td>
                        <td className="num py-3 pr-3 text-right">{cashIn ? rs(r.amount) : ''}</td>
                        <td className="num py-3 text-right">{cashOut ? rs(r.amount) : ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-4 text-sm text-muted">{data.note} The list shows the newest 500 entries; the totals cover the whole period.</p>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
