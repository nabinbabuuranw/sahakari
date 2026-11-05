import React, { useMemo, useState } from 'react';
import { useData } from '../lib/useData';
import { Link, useRouter } from '../lib/router';
import { rs, adText } from '../lib/format';
import { post, ApiError, messageFor } from '../lib/api';
import { Button, Chip, Demo, Empty, Field, Notice, PageHead, SegTabs, Sheet, Skeleton, TextInput } from '../components/ui';
import { IconPlus } from '../components/Icons';

interface Row { id: number; member_no: string; full_name: string; phone: string; status: 'active' | 'inactive'; joined_ad: string; savings_balance: number; active_loans: number; is_demo: boolean }

export function Members() {
  const { path, navigate } = useRouter();
  const params = new URLSearchParams(path.split('?')[1] || '');
  const [q, setQ] = useState(params.get('q') || '');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>((params.get('status') as any) || 'all');
  const [adding, setAdding] = useState(false);
  const qs = new URLSearchParams({ status });
  if (q.trim()) qs.set('q', q.trim());
  const { data, error, loading, reload } = useData<{ members: Row[] }>(`/api/members?${qs.toString()}`);
  const rows = useMemo(() => data?.members ?? [], [data]);

  const syncUrl = (nq: string, ns: string) => {
    const u = new URLSearchParams();
    if (nq.trim()) u.set('q', nq.trim());
    if (ns !== 'all') u.set('status', ns);
    const s = u.toString();
    navigate(`/members${s ? `?${s}` : ''}`, { replace: true });
  };

  return (
    <div className="space-y-8">
      <PageHead kicker="Members" title="Members">
        <Button onClick={() => setAdding(true)}><IconPlus /> Add member</Button>
      </PageHead>

      <div className="rise rise-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="w-full md:max-w-sm">
          <Field label="Search" htmlFor="q" hint="Name, member number or phone">
            <TextInput id="q" type="search" value={q} onChange={(e) => { setQ(e.target.value); syncUrl(e.target.value, status); }} placeholder="Search members" />
          </Field>
        </div>
        <SegTabs
          label="Filter by status"
          value={status}
          options={[{ value: 'all', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
          onChange={(v) => { setStatus(v); syncUrl(q, v); }}
        />
      </div>

      {error ? <Notice tone="error">{error} <button className="btn btn-quiet" onClick={reload}>Try again</button></Notice> : null}
      {!data && !error ? <div aria-busy="true" aria-label="Loading members"><Skeleton lines={6} /></div> : null}
      {data && rows.length === 0 ? (
        <Empty title={q ? 'No member matches that search' : 'No members yet'}>
          {q ? 'Try a shorter name or the member number.' : 'Add the first member, then give them their membership code.'}
        </Empty>
      ) : null}

      {rows.length > 0 ? (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[40rem] border-collapse text-[0.95rem]">
              <caption className="sr-only">Members</caption>
              <thead>
                <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                  <th scope="col" className="py-3 pr-4 font-semibold">No.</th>
                  <th scope="col" className="py-3 pr-4 font-semibold">Name</th>
                  <th scope="col" className="py-3 pr-4 font-semibold">Status</th>
                  <th scope="col" className="py-3 pr-4 text-right font-semibold">Savings</th>
                  <th scope="col" className="py-3 pr-4 text-right font-semibold">Active loans</th>
                  <th scope="col" className="py-3 font-semibold"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-line transition-colors hover:bg-surface">
                    <td className="num py-3.5 pr-4 text-muted">{r.member_no}</td>
                    <td className="py-3.5 pr-4">
                      <Link to={`/members/${r.id}`} className="font-semibold hover:text-primary">{r.full_name}</Link>
                      {r.is_demo ? <span className="ml-2 align-middle"><Demo /></span> : null}
                      <span className="block text-sm text-muted">{r.phone || 'No phone'} · joined {adText(r.joined_ad)}</span>
                    </td>
                    <td className="py-3.5 pr-4">{r.status === 'active' ? <Chip tone="paid">Active</Chip> : <Chip tone="open">Inactive</Chip>}</td>
                    <td className="num py-3.5 pr-4 text-right">{rs(r.savings_balance)}</td>
                    <td className="num py-3.5 pr-4 text-right">{r.active_loans}</td>
                    <td className="py-3.5 text-right"><Link to={`/members/${r.id}`} className="btn btn-quiet">Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="ruled md:hidden">
            {rows.map((r) => (
              <li key={r.id}>
                <Link to={`/members/${r.id}`} className="flex items-center justify-between gap-3 py-4">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{r.full_name}{r.is_demo ? <span className="ml-2 align-middle"><Demo /></span> : null}</span>
                    <span className="num block text-sm text-muted">{r.member_no} · {r.active_loans ? `${r.active_loans} loan` : 'no loan'}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="num block font-semibold">{rs(r.savings_balance)}</span>
                    {r.status === 'inactive' ? <span className="text-sm text-muted">Inactive</span> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {loading && data ? <span className="sr-only">Refreshing</span> : null}

      <AddMember open={adding} onClose={() => setAdding(false)} onCreated={(id) => { setAdding(false); navigate(`/members/${id}`); }} />
    </div>
  );
}

function AddMember({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: number) => void }) {
  const [f, setF] = useState({ full_name: '', phone: '', address: '', nominee_name: '', nominee_relation: '', joined_ad: new Date(Date.now() + 5.75 * 3600e3).toISOString().slice(0, 10) });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e: Record<string, string> = {};
    if (!f.full_name.trim()) e.full_name = 'Enter the member\'s full name.';
    if (f.phone.trim() && !/^(\+977)?[\d\s-]{7,15}$/.test(f.phone.trim())) e.phone = 'Enter a phone number, for example 98XXXXXXXX.';
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    setFormErr(null);
    try {
      const r = await post<{ id: number }>('/api/members', f);
      onCreated(r.id);
    } catch (err) {
      setFormErr(err instanceof ApiError ? err.message : messageFor('server_error'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Add a member">
      <form onSubmit={submit} noValidate className="space-y-5">
        <Field label="Full name" error={errs.full_name} htmlFor="m-name"><TextInput id="m-name" value={f.full_name} onChange={set('full_name')} invalid={!!errs.full_name} autoComplete="off" /></Field>
        <Field label="Phone" error={errs.phone} hint="Optional" htmlFor="m-phone"><TextInput id="m-phone" inputMode="tel" value={f.phone} onChange={set('phone')} invalid={!!errs.phone} /></Field>
        <Field label="Address" hint="Optional" htmlFor="m-addr"><TextInput id="m-addr" value={f.address} onChange={set('address')} /></Field>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Nominee name" hint="Optional" htmlFor="m-nn"><TextInput id="m-nn" value={f.nominee_name} onChange={set('nominee_name')} /></Field>
          <Field label="Nominee relation" hint="Optional" htmlFor="m-nr"><TextInput id="m-nr" value={f.nominee_relation} onChange={set('nominee_relation')} /></Field>
        </div>
        <Field label="Joining date (AD)" hint="The Bikram Sambat date is worked out for you" htmlFor="m-join"><TextInput id="m-join" type="date" value={f.joined_ad} onChange={set('joined_ad')} /></Field>
        {formErr ? <Notice tone="error">{formErr}</Notice> : null}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button type="submit" busy={busy}>Save member</Button>
          <Button type="button" variant="quiet" onClick={onClose}>Cancel</Button>
        </div>
        <p className="text-sm text-muted">After saving you will see the membership code. Give it to the member to create their login.</p>
      </form>
    </Sheet>
  );
}

