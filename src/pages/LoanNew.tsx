import React, { useMemo, useState } from 'react';
import { useData } from '../lib/useData';
import { useRouter, query } from '../lib/router';
import { rs, addMonths, today, bsText } from '../lib/format';
import { ApiError, messageFor, post } from '../lib/api';
import { Button, Field, Notice, PageHead, Select, TextInput } from '../components/ui';
import { buildSchedule, loanLimit, nprToPaisa } from '../../shared/money.ts';

interface Member { id: number; full_name: string; member_no: string; status: string; savings_balance: number; active_loans: number }
interface Detail { id: number; savingsBalance: number; loans: { status: string }[] }
interface Settings { loan_rate_pct: number; loan_multiplier: number }

export function LoanNew() {
  const { path, navigate } = useRouter();
  const preset = query(path).get('member') || '';
  const members = useData<{ members: Member[] }>('/api/members?status=active');
  const settings = useData<Settings>('/api/settings');
  const [memberId, setMemberId] = useState(preset);
  const detail = useData<Detail>(memberId ? `/api/members/${memberId}` : null);
  const [principal, setPrincipal] = useState('');
  const [rate, setRate] = useState<string | null>(null);
  const [term, setTerm] = useState('12');
  const [method, setMethod] = useState<'reducing' | 'flat'>('reducing');
  const [disbursed, setDisbursed] = useState(today());
  const [firstDue, setFirstDue] = useState(addMonths(today(), 1));
  const [firstDueTouched, setFirstDueTouched] = useState(false);
  const [purpose, setPurpose] = useState('');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rateValue = rate ?? (settings.data ? String(settings.data.loan_rate_pct) : '');
  const mult = settings.data?.loan_multiplier ?? 3;
  const balance = detail.data?.savingsBalance ?? null;
  const limitPaisa = balance !== null ? loanLimit(balance, mult) : null;
  const principalPaisa = nprToPaisa(principal.replace(/[,\s]/g, ''));
  const termN = Number(term);
  const rateBp = Math.round(Number(rateValue) * 100);

  const preview = useMemo(() => {
    if (principalPaisa === null || !Number.isInteger(termN) || termN < 1 || termN > 120 || !Number.isFinite(rateBp) || rateBp < 0 || rateBp > 3600) return null;
    try {
      return buildSchedule(principalPaisa, rateBp, termN, method, firstDue);
    } catch {
      return null;
    }
  }, [principalPaisa, termN, rateBp, method, firstDue]);

  const onDisbursed = (v: string) => {
    setDisbursed(v);
    if (!firstDueTouched && v) setFirstDue(addMonths(v, 1));
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e: Record<string, string> = {};
    if (!memberId) e.member = 'Choose a member.';
    if (principalPaisa === null) e.principal = 'Enter the loan amount in rupees.';
    else if (limitPaisa !== null && principalPaisa > limitPaisa) e.principal = `This member can borrow up to ${rs(limitPaisa)}.`;
    if (!Number.isInteger(termN) || termN < 1 || termN > 120) e.term = 'Enter a term from 1 to 120 months.';
    if (!Number.isFinite(rateBp) || rateBp < 0 || rateBp > 3600) e.rate = 'Enter an interest rate from 0 to 36%.';
    if (!purpose.trim()) e.purpose = 'Say what the loan is for.';
    if (firstDue < disbursed) e.firstDue = 'The first installment cannot come before the disbursal date.';
    setErrs(e);
    setFormErr(null);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const r = await post<{ id: number }>('/api/loans', {
        member_id: Number(memberId), principal: principal.replace(/[,\s]/g, ''), annual_rate_pct: Number(rateValue), term_months: termN,
        method, disbursed_ad: disbursed, first_due_ad: firstDue, purpose: purpose.trim(),
      });
      navigate(`/loans/${r.id}`);
    } catch (err) {
      setFormErr(err instanceof ApiError ? err.message : messageFor('server_error'));
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-10">
      <PageHead kicker="Loans" title="Issue a loan" />
      <div className="grid gap-12 md:grid-cols-[1fr_0.9fr]">
        <form onSubmit={submit} noValidate className="rise rise-2 space-y-6">
          <Field label="Member" error={errs.member} htmlFor="ln-member" hint={balance !== null ? `Savings balance ${rs(balance)} · limit ${rs(limitPaisa ?? 0)}` : 'Only active members can borrow.'}>
            <Select id="ln-member" value={memberId} onChange={(e) => setMemberId(e.target.value)} invalid={!!errs.member}>
              <option value="">Choose a member</option>
              {(members.data?.members ?? []).map((m) => <option key={m.id} value={m.id}>{m.full_name} ({m.member_no})</option>)}
            </Select>
          </Field>
          {detail.data && detail.data.loans.some((l) => l.status === 'active') ? (
            <Notice tone="error">This member already has an active loan. Close it before issuing another.</Notice>
          ) : null}
          <Field label="Loan amount (Rs.)" error={errs.principal} htmlFor="ln-p" hint="Up to the limit above">
            <TextInput id="ln-p" inputMode="decimal" value={principal} onChange={(e) => setPrincipal(e.target.value)} invalid={!!errs.principal} placeholder="1,50,000" />
          </Field>
          <div className="grid gap-6 md:grid-cols-3">
            <Field label="Interest % a year" error={errs.rate} htmlFor="ln-r" hint="Set by the cooperative">
              <TextInput id="ln-r" inputMode="decimal" value={rateValue} onChange={(e) => setRate(e.target.value)} invalid={!!errs.rate} />
            </Field>
            <Field label="Term (months)" error={errs.term} htmlFor="ln-t">
              <TextInput id="ln-t" inputMode="numeric" value={term} onChange={(e) => setTerm(e.target.value)} invalid={!!errs.term} />
            </Field>
            <Field label="Method" htmlFor="ln-m" hint={method === 'reducing' ? 'Interest on the falling balance' : 'Interest on the full amount'}>
              <Select id="ln-m" value={method} onChange={(e) => setMethod(e.target.value as any)}>
                <option value="reducing">Reducing balance</option>
                <option value="flat">Flat rate</option>
              </Select>
            </Field>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <Field label="Disbursal date (AD)" htmlFor="ln-d" hint={bsText(disbursed)}>
              <TextInput id="ln-d" type="date" value={disbursed} onChange={(e) => onDisbursed(e.target.value)} />
            </Field>
            <Field label="First installment (AD)" htmlFor="ln-f" error={errs.firstDue} hint={bsText(firstDue)}>
              <TextInput id="ln-f" type="date" value={firstDue} onChange={(e) => { setFirstDueTouched(true); setFirstDue(e.target.value); }} invalid={!!errs.firstDue} />
            </Field>
          </div>
          <Field label="Purpose" error={errs.purpose} htmlFor="ln-purpose">
            <TextInput id="ln-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} invalid={!!errs.purpose} maxLength={200} placeholder="Shop stock, school fees, a motorbike" />
          </Field>
          {formErr ? <Notice tone="error">{formErr}</Notice> : null}
          <div className="flex flex-wrap gap-3 pt-2">
            <Button type="submit" busy={busy} disabled={!!detail.data?.loans.some((l) => l.status === 'active')}>Issue loan</Button>
            <Button type="button" variant="quiet" onClick={() => navigate('/loans')}>Cancel</Button>
          </div>
        </form>

        <aside aria-labelledby="pv-h" className="rise rise-3 self-start border-t-2 border-primary bg-surface p-6">
          <h2 id="pv-h" className="display text-2xl">Before you issue</h2>
          {!preview ? (
            <p className="mt-3 text-muted">Enter an amount, a rate and a term to see the schedule.</p>
          ) : (
            <>
              <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4">
                <div><dt className="text-sm text-muted">Installment</dt><dd className="num display text-2xl">{rs(preview.emi)}</dd></div>
                <div><dt className="text-sm text-muted">Total interest</dt><dd className="num display text-2xl">{rs(preview.totalInterest)}</dd></div>
                <div><dt className="text-sm text-muted">Total to repay</dt><dd className="num display text-2xl">{rs(preview.totalPayable)}</dd></div>
                <div><dt className="text-sm text-muted">Installments</dt><dd className="num display text-2xl">{termN}</dd></div>
              </dl>
              <p className="mt-6 text-sm font-semibold">First three installments</p>
              <ol className="ruled mt-2 text-sm">
                {preview.rows.slice(0, 3).map((r) => (
                  <li key={r.seq} className="flex justify-between gap-3 py-2">
                    <span>{r.seq}. {bsText(r.dueAd)}</span>
                    <span className="num">{rs(r.total)} <span className="text-muted">({rs(r.interest)} interest)</span></span>
                  </li>
                ))}
              </ol>
              {preview.rows.length > 3 ? (
                <p className="mt-2 text-sm text-muted">Last installment: {bsText(preview.rows[preview.rows.length - 1].dueAd)}, {rs(preview.rows[preview.rows.length - 1].total)}.</p>
              ) : null}
            </>
          )}
          <p className="mt-6 border-t border-line pt-4 text-sm text-muted">The figures are the same ones the Worker will save, to the paisa.</p>
        </aside>
      </div>
    </div>
  );
}
