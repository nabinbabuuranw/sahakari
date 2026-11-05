import { useEffect, useState } from 'react';
import { useData } from '../lib/useData';
import { Link } from '../lib/router';
import { rs, adText, bsText, today } from '../lib/format';
import { ApiError, messageFor, post } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button, Chip, Demo, Field, Notice, PageHead, Skeleton, Stat, TextInput } from '../components/ui';

interface View {
  id: number; memberId: number; memberName: string; memberNo: string; principal: number; annualRatePct: number; termMonths: number; method: 'reducing' | 'flat';
  emi: number; totalInterest: number; totalPayable: number; purpose: string; disbursedAd: string; disbursedBs: string; firstDueAd: string; status: 'active' | 'closed'; isDemo: boolean;
  schedule: { seq: number; dueAd: string; dueBs: string; total: number; paid: number; remaining: number; interestPaid: number; principalPaid: number; principalDue: number; interestDue: number; status: 'paid' | 'partial' | 'overdue' | 'open' }[];
  payments: { id: number; amount: number; paidAd: string; paidBs: string; note: string }[];
  summary: { paidTotal: number; principalOutstanding: number; amountDue: number; overdueAmount: number; overdueCount: number; nextDue: { seq: number; dueAd: string; remaining: number; status: string } | null };
}

const STATUS_LABEL = { paid: 'Paid', partial: 'Part paid', overdue: 'Overdue', open: 'Due later' } as const;

export function LoanDetail({ id }: { id: number }) {
  const { data, error, reload } = useData<View>(`/api/loans/${id}`);
  const { user } = useAuth();
  const [note, setNote] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  if (error) return <Notice tone="error">{error}</Notice>;
  if (!data) return <div aria-busy="true" className="space-y-6"><Skeleton lines={8} /></div>;
  const office = user?.role === 'office';
  const s = data.summary;
  return (
    <div className="space-y-10">
      <PageHead kicker={`${data.memberNo} · ${data.memberName}`} title={data.purpose}>
        {data.isDemo ? <Demo /> : null}
        {data.status === 'closed' ? <Chip tone="paid">Closed</Chip> : s.overdueCount ? <Chip tone="overdue">{s.overdueCount} overdue</Chip> : <Chip tone="open">On schedule</Chip>}
        {office ? <Link to={`/members/${data.memberId}`} className="btn btn-ghost">Member</Link> : null}
      </PageHead>
      {note ? <Notice tone={note.tone}>{note.text}</Notice> : null}

      <section aria-label="Loan summary" className="rise rise-2 grid grid-cols-2 gap-y-6 border-b border-line pb-8 md:grid-cols-4 md:divide-x md:divide-line">
        <Stat label="Principal left" value={rs(s.principalOutstanding)} sub={`of ${rs(data.principal)}`} />
        <Stat label="Due now" value={rs(s.amountDue)} sub={s.nextDue ? `Next: installment ${s.nextDue.seq}, ${adText(s.nextDue.dueAd)}` : 'Nothing due'} />
        <Stat label="Overdue" value={rs(s.overdueAmount)} tone={s.overdueAmount ? 'danger' : undefined} sub={s.overdueCount ? `${s.overdueCount} installment${s.overdueCount > 1 ? 's' : ''} past date` : 'Up to date'} />
        <Stat label="Paid so far" value={rs(s.paidTotal)} sub={`Installment ${rs(data.emi)}`} />
      </section>

        <section aria-labelledby="sch-h" className="rise rise-3">
          <h2 id="sch-h" className="display text-2xl">Repayment schedule</h2>
          <p className="mt-1 text-sm text-muted">{data.annualRatePct}% a year, {data.termMonths} months, {data.method === 'flat' ? 'flat rate' : 'reducing balance'}. Interest {rs(data.totalInterest)}, total {rs(data.totalPayable)}. Payments clear the oldest installment first.</p>
          <div className="mt-5 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[40rem] border-collapse text-[0.93rem]">
              <caption className="sr-only">Repayment schedule for this loan</caption>
              <thead>
                <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                  <th scope="col" className="py-2.5 pr-3 font-semibold">No.</th>
                  <th scope="col" className="py-2.5 pr-3 font-semibold">Due</th>
                  <th scope="col" className="py-2.5 pr-3 text-right font-semibold">Principal</th>
                  <th scope="col" className="py-2.5 pr-3 text-right font-semibold">Interest</th>
                  <th scope="col" className="py-2.5 pr-3 text-right font-semibold">Installment</th>
                  <th scope="col" className="py-2.5 pr-3 text-right font-semibold">Remaining</th>
                  <th scope="col" className="py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.schedule.map((r) => (
                  <tr key={r.seq} className="border-b border-line">
                    <td className="num py-3 pr-3 align-top text-muted">{r.seq}</td>
                    <td className="py-3 pr-3 align-top"><span className="block">{bsText(r.dueAd)}</span><span className="text-sm text-muted">{adText(r.dueAd)}</span></td>
                    <td className="num py-3 pr-3 text-right align-top">{rs(r.principalDue)}</td>
                    <td className="num py-3 pr-3 text-right align-top">{rs(r.interestDue)}</td>
                    <td className="num py-3 pr-3 text-right align-top">{rs(r.total)}</td>
                    <td className="num py-3 pr-3 text-right align-top font-semibold">{r.remaining ? rs(r.remaining) : '—'}</td>
                    <td className="py-3 align-top">
                      <Chip tone={r.status === 'paid' ? 'paid' : r.status === 'overdue' ? 'overdue' : r.status === 'partial' ? 'partial' : 'open'}>{STATUS_LABEL[r.status]}</Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ol className="ruled mt-5 md:hidden" aria-label="Repayment schedule">
            {data.schedule.map((r) => (
              <li key={r.seq} className="grid grid-cols-[auto_1fr_auto] gap-x-3 py-3.5 text-[0.95rem]">
                <span className="num text-muted">{r.seq}.</span>
                <span className="min-w-0">
                  <span className="block">{bsText(r.dueAd)}</span>
                  <span className="block text-sm text-muted">Principal {rs(r.principalDue)} · interest {rs(r.interestDue)}</span>
                  {r.remaining && r.remaining !== r.total ? <span className="block text-sm text-muted">Still to pay {rs(r.remaining)}</span> : null}
                </span>
                <span className="text-right">
                  <span className="num block font-semibold">{rs(r.total)}</span>
                  <Chip tone={r.status === 'paid' ? 'paid' : r.status === 'overdue' ? 'overdue' : r.status === 'partial' ? 'partial' : 'open'}>{STATUS_LABEL[r.status]}</Chip>
                </span>
              </li>
            ))}
          </ol>
        </section>
      <div className="grid gap-10 md:grid-cols-[1fr_1fr]">
          {office && data.status === 'active' ? (
          <PaymentForm loanId={data.id} suggested={s.amountDue} onSaved={(msg) => { setNote({ tone: 'success', text: msg }); reload(); }} onError={(msg) => setNote({ tone: 'error', text: msg })} />
        ) : null}
        <section aria-labelledby="pay-h" className="rise rise-3">
          <h2 id="pay-h" className="display text-2xl">Repayments</h2>
          {data.payments.length === 0 ? <p className="mt-3 text-muted">No repayments recorded yet.</p> : (
            <ul className="ruled mt-3">
              {[...data.payments].reverse().map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                  <span><span className="block">{bsText(p.paidAd)}</span><span className="block text-sm text-muted">{p.note || adText(p.paidAd)}</span></span>
                  <span className="num font-semibold">{rs(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <p className="text-sm text-muted">Disbursed {bsText(data.disbursedAd)} ({adText(data.disbursedAd)}).</p>
      </div>
    </div>
  );
}

function PaymentForm({ loanId, suggested, onSaved, onError }: { loanId: number; suggested: number; onSaved: (m: string) => void; onError: (m: string) => void }) {
  const [amount, setAmount] = useState((suggested / 100).toFixed(2));
  useEffect(() => setAmount((suggested / 100).toFixed(2)), [suggested]);
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <section aria-labelledby="rp-h" className="rise rise-2 border-t-2 border-primary bg-surface p-6">
      <h2 id="rp-h" className="display text-2xl">Record a repayment</h2>
      <form className="mt-4 space-y-5" noValidate onSubmit={async (ev) => {
        ev.preventDefault();
        setErr(null); setBusy(true);
        try {
          const r = await post<{ summary: { amountDue: number } }>(`/api/loans/${loanId}/payments`, { amount: amount.replace(/[,\s]/g, ''), paid_ad: date, note: note.trim() });
          onSaved(r.summary.amountDue === 0 ? 'Payment recorded. This loan is now fully paid.' : `Payment recorded. ${rs(r.summary.amountDue)} still due.`);
          setNote('');
        } catch (e) {
          const m = e instanceof ApiError ? e.message : messageFor('server_error');
          setErr(m); onError(m);
        } finally { setBusy(false); }
      }}>
        <Field label="Amount received (Rs.)" htmlFor="pay-amt" hint={`Due now: ${rs(suggested)}`}>
          <TextInput id="pay-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Date received (AD)" htmlFor="pay-date" hint={bsText(date)}>
          <TextInput id="pay-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Note" htmlFor="pay-note" hint="Optional, for example receipt number">
          <TextInput id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
        </Field>
        {err ? <Notice tone="error">{err}</Notice> : null}
        <Button type="submit" busy={busy}>Save payment</Button>
      </form>
    </section>
  );
}
