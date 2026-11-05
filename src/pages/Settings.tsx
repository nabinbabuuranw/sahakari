import React, { useState } from 'react';
import { useData } from '../lib/useData';
import { useAuth } from '../lib/auth';
import { ApiError, messageFor, post, put } from '../lib/api';
import { adText } from '../lib/format';
import { Button, Demo, Empty, Field, Notice, PageHead, Skeleton, Sheet, TextInput } from '../components/ui';
import { IconPlus } from '../components/Icons';

interface Settings { name: string; reg_no: string; address: string; phone: string; savings_rate_pct: number; loan_rate_pct: number; loan_multiplier: number }
interface Staff { staff: { id: number; email: string; name: string; is_demo: boolean }[] }
interface Audit { entries: { id: number; actor_email: string; action: string; target: string; detail: string; created_at: number }[] }

export function Settings() {
  const s = useData<Settings>('/api/settings');
  const staff = useData<Staff>('/api/staff');
  const audit = useData<Audit>('/api/audit');
  const { user } = useAuth();
  const [note, setNote] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState(false);
  return (
    <div className="space-y-12">
      <PageHead kicker="Office" title="Settings" />
      {note ? <Notice tone={note.tone}>{note.text}</Notice> : null}

      <section aria-labelledby="coop-h" className="rise rise-2 grid gap-10 md:grid-cols-[0.8fr_1.2fr]">
        <div>
          <h2 id="coop-h" className="display text-2xl">Cooperative</h2>
          <p className="mt-2 text-[0.98rem] text-muted">These rates and limits apply to new entries. Records already made keep the terms they were made on. Set them to match your bylaws.</p>
        </div>
        {!s.data ? <Skeleton lines={5} /> : <SettingsForm key={JSON.stringify(s.data)} initial={s.data} onSaved={() => { setNote({ tone: 'success', text: 'Settings saved.' }); s.reload(); audit.reload(); }} onError={(m) => setNote({ tone: 'error', text: m })} />}
      </section>

      <section aria-labelledby="staff-h" className="rise rise-3 grid gap-10 border-t border-line pt-10 md:grid-cols-[0.8fr_1.2fr]">
        <div>
          <h2 id="staff-h" className="display text-2xl">Office staff</h2>
          <p className="mt-2 text-[0.98rem] text-muted">Anyone with an office login can record entries, issue loans and see every member. Only add people you trust with the books.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={() => setAdding(true)}><IconPlus /> Add staff login</Button>
            {user?.isDemo ? <Button variant="ghost" onClick={() => setResetting(true)}>Reset demo data</Button> : null}
          </div>
        </div>
        <div>
          {!staff.data ? <Skeleton lines={3} /> : (
            <ul className="ruled">
              {staff.data.staff.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3.5">
                  <span className="min-w-0"><span className="block truncate font-semibold">{p.name}</span><span className="block truncate text-sm text-muted">{p.email}</span></span>
                  {p.is_demo ? <Demo /> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-labelledby="audit-h" className="rise rise-3 border-t border-line pt-10">
        <h2 id="audit-h" className="display text-2xl">Audit trail</h2>
        <p className="mt-2 max-w-[40rem] text-[0.98rem] text-muted">Every entry, password reset, rate change and staff login. Newest first, last 200.</p>
        {audit.error ? <Notice tone="error">{audit.error}</Notice> : null}
        {!audit.data ? <div className="mt-5"><Skeleton lines={4} /></div> : audit.data.entries.length === 0 ? <div className="mt-5"><Empty title="Nothing logged yet" /></div> : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-[0.92rem]">
              <caption className="sr-only">Audit trail</caption>
              <thead>
                <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                  <th scope="col" className="py-2.5 pr-3 font-semibold">When</th>
                  <th scope="col" className="py-2.5 pr-3 font-semibold">Who</th>
                  <th scope="col" className="py-2.5 pr-3 font-semibold">What</th>
                  <th scope="col" className="py-2.5 font-semibold">Detail</th>
                </tr>
              </thead>
              <tbody>
                {audit.data.entries.map((e) => (
                  <tr key={e.id} className="border-b border-line align-top">
                    <td className="num whitespace-nowrap py-2.5 pr-3 text-muted">{new Date(e.created_at + 5.75 * 3600e3).toISOString().slice(0, 16).replace('T', ' ')}</td>
                    <td className="py-2.5 pr-3">{e.actor_email}</td>
                    <td className="py-2.5 pr-3 font-semibold">{e.action}</td>
                    <td className="py-2.5 text-muted">{e.target}{e.detail ? ` · ${e.detail}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-sm text-muted">Times are Nepal time (UTC+05:45). Dates in entries are {adText(new Date().toISOString().slice(0, 10))} or earlier, in AD.</p>
          </div>
        )}
      </section>

      <AddStaff open={adding} onClose={() => setAdding(false)} onDone={() => { setAdding(false); setNote({ tone: 'success', text: 'Staff login added.' }); staff.reload(); audit.reload(); }} />
      <ResetDemo open={resetting} onClose={() => setResetting(false)} onDone={() => { setResetting(false); window.location.reload(); }} />
    </div>
  );
}

function SettingsForm({ initial, onSaved, onError }: { initial: Settings; onSaved: () => void; onError: (m: string) => void }) {
  const [f, setF] = useState({ name: initial.name, reg_no: initial.reg_no, address: initial.address, phone: initial.phone, savings_rate_pct: String(initial.savings_rate_pct), loan_rate_pct: String(initial.loan_rate_pct), loan_multiplier: String(initial.loan_multiplier) });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="space-y-5" noValidate onSubmit={async (ev) => {
      ev.preventDefault();
      const e: Record<string, string> = {};
      if (!f.name.trim()) e.name = 'Enter the cooperative name.';
      if (!(Number(f.savings_rate_pct) >= 0 && Number(f.savings_rate_pct) <= 20)) e.savings_rate_pct = 'From 0 to 20.';
      if (!(Number(f.loan_rate_pct) >= 0 && Number(f.loan_rate_pct) <= 36)) e.loan_rate_pct = 'From 0 to 36.';
      if (!/^\d+$/.test(f.loan_multiplier) || Number(f.loan_multiplier) < 1 || Number(f.loan_multiplier) > 10) e.loan_multiplier = 'A whole number from 1 to 10.';
      setErrs(e);
      if (Object.keys(e).length) return;
      setBusy(true);
      try {
        await put('/api/settings', { ...f, savings_rate_pct: Number(f.savings_rate_pct), loan_rate_pct: Number(f.loan_rate_pct), loan_multiplier: Number(f.loan_multiplier) });
        onSaved();
      } catch (err) {
        onError(err instanceof ApiError ? err.message : messageFor('server_error'));
      } finally { setBusy(false); }
    }}>
      <Field label="Cooperative name" error={errs.name} htmlFor="s-name"><TextInput id="s-name" value={f.name} onChange={set('name')} invalid={!!errs.name} /></Field>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Registration number" htmlFor="s-reg" hint="As it appears on your certificate"><TextInput id="s-reg" value={f.reg_no} onChange={set('reg_no')} /></Field>
        <Field label="Phone" htmlFor="s-phone"><TextInput id="s-phone" value={f.phone} onChange={set('phone')} /></Field>
      </div>
      <Field label="Address" htmlFor="s-addr"><TextInput id="s-addr" value={f.address} onChange={set('address')} /></Field>
      <div className="grid gap-5 md:grid-cols-3">
        <Field label="Savings interest % a year" error={errs.savings_rate_pct} htmlFor="s-sr"><TextInput id="s-sr" inputMode="decimal" value={f.savings_rate_pct} onChange={set('savings_rate_pct')} invalid={!!errs.savings_rate_pct} /></Field>
        <Field label="Loan interest % a year" error={errs.loan_rate_pct} htmlFor="s-lr"><TextInput id="s-lr" inputMode="decimal" value={f.loan_rate_pct} onChange={set('loan_rate_pct')} invalid={!!errs.loan_rate_pct} /></Field>
        <Field label="Loan limit (× savings)" error={errs.loan_multiplier} hint="A member can borrow up to this many times their savings balance" htmlFor="s-lm"><TextInput id="s-lm" inputMode="numeric" value={f.loan_multiplier} onChange={set('loan_multiplier')} invalid={!!errs.loan_multiplier} /></Field>
      </div>
      <Button type="submit" busy={busy}>Save settings</Button>
    </form>
  );
}

function AddStaff({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title="Add a staff login">
      <form className="space-y-5" noValidate onSubmit={async (ev) => {
        ev.preventDefault(); setBusy(true); setErr(null);
        try { await post('/api/staff', f); setF({ name: '', email: '', password: '' }); onDone(); }
        catch (e) { setErr(e instanceof ApiError ? e.message : messageFor('server_error')); }
        finally { setBusy(false); }
      }}>
        <Field label="Name" htmlFor="st-name"><TextInput id="st-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Email" htmlFor="st-email"><TextInput id="st-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Temporary password" hint="At least 8 characters. Ask them to change it on the Account page." htmlFor="st-pw"><TextInput id="st-pw" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        {err ? <Notice tone="error">{err}</Notice> : null}
        <div className="flex gap-3"><Button type="submit" busy={busy}>Add login</Button><Button type="button" variant="quiet" onClick={onClose}>Cancel</Button></div>
      </form>
    </Sheet>
  );
}

function ResetDemo({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Sheet open={open} onClose={onClose} title="Reset the demo">
      <div className="space-y-5">
        <p>This puts back the invented demo members, loans and entries. Real members and their records are not touched.</p>
        {err ? <Notice tone="error">{err}</Notice> : null}
        <div className="flex gap-3">
          <Button variant="danger" busy={busy} onClick={async () => {
            setBusy(true); setErr(null);
            try { await post('/api/demo/reset'); onDone(); }
            catch (e) { setErr(e instanceof ApiError ? e.message : messageFor('server_error')); }
            finally { setBusy(false); }
          }}>Reset demo</Button>
          <Button variant="quiet" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Sheet>
  );
}
