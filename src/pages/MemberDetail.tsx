import React, { useState } from 'react';
import { useData } from '../lib/useData';
import { Link } from '../lib/router';
import { rs, adText, bsText } from '../lib/format';
import { ApiError, messageFor, patch, post } from '../lib/api';
import { Button, Chip, Demo, Empty, Field, Notice, PageHead, Select, Sheet, Skeleton, TextInput } from '../components/ui';
import { IconPrint } from '../components/Icons';
import { nprToPaisa } from '../../shared/money.ts';

interface Detail {
  id: number; memberNo: string; fullName: string; phone: string; address: string; nomineeName: string; nomineeRelation: string;
  joinedAd: string; joinedBs: string; status: 'active' | 'inactive'; isDemo: boolean; savingsBalance: number;
  memberCode?: string; loginEmail?: string | null;
  loans: { id: number; principal: number; emi: number; status: 'active' | 'closed'; disbursedAd: string; disbursedBs: string; purpose: string; summary: { principalOutstanding: number; overdueCount: number; amountDue: number } }[];
}
interface Ledger { ledger: { id: number; kind: string; amount: number; dateAd: string; dateBs: string; note: string; balance: number }[]; balance: number }

const KIND_LABEL: Record<string, string> = { deposit: 'Deposit', withdrawal: 'Withdrawal', interest: 'Interest' };

export function MemberDetail({ id }: { id: number }) {
  const { data, error, reload } = useData<Detail>(`/api/members/${id}`);
  const ledger = useData<Ledger>(`/api/members/${id}/savings`);
  const [entry, setEntry] = useState(false);
  const [edit, setEdit] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [note, setNote] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  if (error) return <Notice tone="error">{error}</Notice>;
  if (!data) return <div aria-busy="true" className="space-y-6"><Skeleton lines={7} /></div>;
  const refresh = () => { reload(); ledger.reload(); };

  return (
    <div className="space-y-10">
      <PageHead kicker={`${data.memberNo} · ${data.status === 'active' ? 'Active' : 'Inactive'}`} title={data.fullName}>
        {data.isDemo ? <Demo /> : null}
        <Link to={`/members/${id}/statement`} className="btn btn-ghost"><IconPrint /> Passbook</Link>
        <Button variant="ghost" onClick={() => setEdit(true)}>Edit details</Button>
      </PageHead>

      {note ? <Notice tone={note.tone}>{note.text}</Notice> : null}

      <section aria-label="Savings" className="rise rise-2 grid gap-8 border-b border-line pb-8 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Savings balance</p>
          <p className="display num mt-1 text-[2.3rem] leading-none md:text-[3.2rem]">{rs(data.savingsBalance)}</p>
          <p className="mt-3 text-sm text-muted">{data.phone || 'No phone'} · joined {bsText(data.joinedAd)} ({adText(data.joinedAd)})</p>
          {data.nomineeName ? <p className="text-sm text-muted">Nominee: {data.nomineeName}{data.nomineeRelation ? `, ${data.nomineeRelation}` : ''}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setEntry(true)} disabled={data.status !== 'active'}>Record savings</Button>
          <Link to={`/loans/new?member=${id}`} className={`btn btn-ghost ${data.status !== 'active' ? 'pointer-events-none opacity-55' : ''}`}>Issue a loan</Link>
        </div>
      </section>

      <section aria-labelledby="access-h" className="rise rise-3 grid gap-6 md:grid-cols-2">
        <div>
          <h2 id="access-h" className="display text-2xl">Member login</h2>
          {data.loginEmail ? (
            <p className="mt-2 text-[0.98rem]">Signed up as <span className="font-semibold">{data.loginEmail}</span>.</p>
          ) : (
            <p className="mt-2 text-[0.98rem] text-muted">No login yet. Give the member their code and they create one.</p>
          )}
          {data.memberCode ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="num rounded border border-line bg-surface px-3 py-2 font-semibold tracking-wide">{data.memberCode}</span>
              <CopyButton text={data.memberCode} />
            </div>
          ) : null}
          <p className="mt-2 text-sm text-muted">The code works once. It links one login to this member.</p>
          {data.loginEmail ? (
            <div className="mt-4">
              <Button variant="ghost" onClick={() => setResetOpen(true)}>Issue a temporary password</Button>
            </div>
          ) : null}
        </div>
        <div>
          <h2 className="display text-2xl">Status</h2>
          <p className="mt-2 text-[0.98rem] text-muted">Inactive members cannot take new entries or loans. Their records stay.</p>
          <StatusToggle id={id} status={data.status} onDone={(msg) => { setNote({ tone: 'success', text: msg }); refresh(); }} onError={(msg) => setNote({ tone: 'error', text: msg })} />
        </div>
      </section>

      <section aria-labelledby="loans-h" className="rise rise-3">
        <div className="flex items-baseline justify-between">
          <h2 id="loans-h" className="display text-2xl">Loans</h2>
          <Link to={`/loans/new?member=${id}`} className="text-sm font-semibold text-primary underline underline-offset-4">New loan</Link>
        </div>
        {data.loans.length === 0 ? <div className="mt-4"><Empty title="No loans yet" /></div> : (
          <ul className="ruled mt-4">
            {data.loans.map((l) => (
              <li key={l.id}>
                <Link to={`/loans/${l.id}`} className="flex flex-wrap items-center justify-between gap-3 py-4 hover:text-primary">
                  <span>
                    <span className="block font-semibold">{l.purpose}</span>
                    <span className="block text-sm text-muted">Disbursed {bsText(l.disbursedAd)} · EMI {rs(l.emi)}</span>
                  </span>
                  <span className="text-right">
                    <span className="num block font-semibold">{rs(l.summary.principalOutstanding)} <span className="text-sm font-normal text-muted">outstanding</span></span>
                    {l.status === 'closed' ? <Chip tone="paid">Closed</Chip> : l.summary.overdueCount ? <Chip tone="overdue">{l.summary.overdueCount} overdue</Chip> : <Chip tone="open">On schedule</Chip>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="ledger-h" className="rise rise-3">
        <h2 id="ledger-h" className="display text-2xl">Savings ledger</h2>
        {ledger.error ? <Notice tone="error">{ledger.error}</Notice> : null}
        {!ledger.data ? <div className="mt-4" aria-busy="true"><Skeleton lines={4} /></div> : ledger.data.ledger.length === 0 ? (
          <div className="mt-4"><Empty title="No savings yet">Record the first deposit to start the account.</Empty></div>
        ) : (
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[34rem] border-collapse text-[0.95rem]">
              <caption className="sr-only">Savings ledger for {data.fullName}, newest first</caption>
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
                {[...ledger.data.ledger].reverse().map((r) => (
                  <tr key={r.id} className="border-b border-line">
                    <td className="py-3 pr-3 align-top"><span className="block">{bsText(r.dateAd)}</span><span className="text-sm text-muted">{adText(r.dateAd)}</span></td>
                    <td className="py-3 pr-3 align-top">{KIND_LABEL[r.kind] ?? r.kind}</td>
                    <td className="py-3 pr-3 align-top text-muted">{r.note || '—'}</td>
                    <td className={`num py-3 pr-3 text-right align-top ${r.kind === 'withdrawal' ? 'text-danger' : ''}`}>{r.kind === 'withdrawal' ? '−' : '+'}{rs(r.amount)}</td>
                    <td className="num py-3 text-right align-top font-semibold">{rs(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {ledger.data && ledger.data.ledger.length > 0 ? (
          <ul className="ruled mt-4 md:hidden">
            {[...ledger.data.ledger].reverse().map((r) => (
              <li key={r.id} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 py-3.5 text-[0.95rem]">
                <span className="font-semibold">{KIND_LABEL[r.kind] ?? r.kind}</span>
                <span className={`num text-right font-semibold ${r.kind === 'withdrawal' ? 'text-danger' : ''}`}>{r.kind === 'withdrawal' ? '−' : '+'}{rs(r.amount)}</span>
                <span className="text-sm text-muted">{bsText(r.dateAd)}{r.note ? ` · ${r.note}` : ''}</span>
                <span className="num text-right text-sm text-muted">Bal. {rs(r.balance)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <EntrySheet open={entry} memberId={id} onClose={() => setEntry(false)} onSaved={(msg) => { setEntry(false); setNote({ tone: 'success', text: msg }); refresh(); }} />
      <EditSheet open={edit} detail={data} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); setNote({ tone: 'success', text: 'Details saved.' }); refresh(); }} />
      <ResetSheet open={resetOpen} memberId={id} onClose={() => setResetOpen(false)} />
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn btn-ghost"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800); } catch { setDone(false); }
      }}
    >
      {done ? 'Copied' : 'Copy code'}
    </button>
  );
}

function StatusToggle({ id, status, onDone, onError }: { id: number; status: 'active' | 'inactive'; onDone: (m: string) => void; onError: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  const next = status === 'active' ? 'inactive' : 'active';
  return (
    <div className="mt-4">
      <Button variant="ghost" busy={busy} onClick={async () => {
        setBusy(true);
        try {
          await patch(`/api/members/${id}`, { status: next });
          onDone(next === 'active' ? 'Member marked active.' : 'Member marked inactive.');
        } catch (e) {
          onError(e instanceof ApiError ? e.message : messageFor('server_error'));
        } finally { setBusy(false); }
      }}>
        {status === 'active' ? 'Mark as inactive' : 'Mark as active'}
      </Button>
    </div>
  );
}

function EntrySheet({ open, memberId, onClose, onSaved }: { open: boolean; memberId: number; onClose: () => void; onSaved: (m: string) => void }) {
  const today = new Date(Date.now() + 5.75 * 3600e3).toISOString().slice(0, 10);
  const [kind, setKind] = useState<'deposit' | 'withdrawal' | 'interest'>('deposit');
  const [amount, setAmount] = useState('');
  const [months, setMonths] = useState('3');
  const [date, setDate] = useState(today);
  const [noteText, setNoteText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const body: Record<string, unknown> = { kind, date, note: noteText.trim() };
      if (kind === 'interest') body.months = Number(months);
      else {
        const p = nprToPaisa(amount.replace(/\s/g, ''));
        if (p === null) { setErr('Enter an amount in rupees, for example 2,500 or 2,500.50.'); setBusy(false); return; }
        body.amount = amount.replace(/[,\s]/g, '');
      }
      const r = await post<{ balance: number }>(`/api/members/${memberId}/savings`, body);
      setAmount(''); setNoteText('');
      onSaved(`${kind === 'deposit' ? 'Deposit' : kind === 'withdrawal' ? 'Withdrawal' : 'Interest'} recorded. Balance now ${rs(r.balance)}.`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : messageFor('server_error'));
    } finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Record a savings entry">
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Field label="Entry" htmlFor="e-kind">
          <Select id="e-kind" value={kind} onChange={(e) => setKind(e.target.value as any)}>
            <option value="deposit">Deposit (cash received)</option>
            <option value="withdrawal">Withdrawal (cash paid out)</option>
            <option value="interest">Interest (book entry, not cash)</option>
          </Select>
        </Field>
        {kind === 'interest' ? (
          <Field label="Months of interest" hint="Interest is worked out on the current balance at the cooperative's savings rate." htmlFor="e-months">
            <Select id="e-months" value={months} onChange={(e) => setMonths(e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m} month{m > 1 ? 's' : ''}</option>)}
            </Select>
          </Field>
        ) : (
          <Field label="Amount (Rs.)" htmlFor="e-amt" hint="Up to two decimal places">
            <TextInput id="e-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="2,500" />
          </Field>
        )}
        <Field label="Date (AD)" hint="Shown in Bikram Sambat on the passbook" htmlFor="e-date">
          <TextInput id="e-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Note" hint="Optional" htmlFor="e-note">
          <TextInput id="e-note" value={noteText} onChange={(e) => setNoteText(e.target.value)} maxLength={200} />
        </Field>
        {err ? <Notice tone="error">{err}</Notice> : null}
        <div className="flex gap-3"><Button type="submit" busy={busy}>Save entry</Button><Button type="button" variant="quiet" onClick={onClose}>Cancel</Button></div>
      </form>
    </Sheet>
  );
}

function EditSheet({ open, detail, onClose, onSaved }: { open: boolean; detail: Detail; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ full_name: detail.fullName, phone: detail.phone, address: detail.address, nominee_name: detail.nomineeName, nominee_relation: detail.nomineeRelation });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setBusy(true); setErr(null);
    try { await patch(`/api/members/${detail.id}`, f); onSaved(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : messageFor('server_error')); }
    finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Edit member details">
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Field label="Full name" htmlFor="x-name"><TextInput id="x-name" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
        <Field label="Phone" htmlFor="x-phone"><TextInput id="x-phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Address" htmlFor="x-addr"><TextInput id="x-addr" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Nominee name" htmlFor="x-nn"><TextInput id="x-nn" value={f.nominee_name} onChange={(e) => setF({ ...f, nominee_name: e.target.value })} /></Field>
          <Field label="Nominee relation" htmlFor="x-nr"><TextInput id="x-nr" value={f.nominee_relation} onChange={(e) => setF({ ...f, nominee_relation: e.target.value })} /></Field>
        </div>
        {err ? <Notice tone="error">{err}</Notice> : null}
        <div className="flex gap-3"><Button type="submit" busy={busy}>Save details</Button><Button type="button" variant="quiet" onClick={onClose}>Cancel</Button></div>
      </form>
    </Sheet>
  );
}

function ResetSheet({ open, memberId, onClose }: { open: boolean; memberId: number; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [temp, setTemp] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const close = () => { setTemp(null); setErr(null); onClose(); };
  return (
    <Sheet open={open} onClose={close} title="Issue a temporary password">
      {!temp ? (
        <div className="space-y-5">
          <p className="text-[0.98rem]">This ends every session the member has open and gives you a one-time temporary password to pass on in person. Only do this when the member has asked you.</p>
          {err ? <Notice tone="error">{err}</Notice> : null}
          <div className="flex gap-3">
            <Button variant="danger" busy={busy} onClick={async () => {
              setBusy(true); setErr(null);
              try { const r = await post<{ temporaryPassword: string }>(`/api/members/${memberId}/reset-password`); setTemp(r.temporaryPassword); }
              catch (e) { setErr(e instanceof ApiError ? e.message : messageFor('server_error')); }
              finally { setBusy(false); }
            }}>Issue password</Button>
            <Button variant="quiet" onClick={close}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-[0.98rem]">Temporary password. It is shown once, so write it down or pass it on now.</p>
          <p className="num rounded border border-line bg-surface px-4 py-3 text-xl font-semibold tracking-wider">{temp}</p>
          <p className="text-sm text-muted">The member should sign in and change it on the Account page.</p>
          <Button onClick={close}>Done</Button>
        </div>
      )}
    </Sheet>
  );
}
