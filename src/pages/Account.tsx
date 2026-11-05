import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { ApiError, messageFor, post } from '../lib/api';
import { Button, Demo, Field, Notice, PageHead, TextInput } from '../components/ui';

export function Account() {
  const { user, signOut } = useAuth();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [formErr, setFormErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-10">
      <PageHead kicker="Account" title="Your login" />
      <section className="rise rise-2 grid gap-10 md:grid-cols-2">
        <dl className="space-y-4">
          <div><dt className="text-sm text-muted">Name</dt><dd className="text-lg font-semibold">{user?.name}</dd></div>
          <div><dt className="text-sm text-muted">Email</dt><dd className="text-lg">{user?.email}</dd></div>
          <div><dt className="text-sm text-muted">Role</dt><dd>{user?.role === 'office' ? 'Cooperative office' : 'Member'}</dd></div>
          {user?.isDemo ? <div><Demo /></div> : null}
          <div className="pt-2"><Button variant="ghost" onClick={() => signOut().then(() => { window.location.href = '/'; })}>Sign out</Button></div>
        </dl>
        <form className="space-y-5" noValidate onSubmit={async (ev) => {
          ev.preventDefault();
          const e: Record<string, string> = {};
          if (!cur) e.cur = 'Enter your current password.';
          if (next.length < 8) e.next = 'Use at least 8 characters.';
          if (next !== again) e.again = 'The two new passwords do not match.';
          setErrs(e); setFormErr(null); setDone(false);
          if (Object.keys(e).length) return;
          setBusy(true);
          try { await post('/api/auth/change-password', { current: cur, next }); setCur(''); setNext(''); setAgain(''); setDone(true); }
          catch (err) { setFormErr(err instanceof ApiError ? err.message : messageFor('server_error')); }
          finally { setBusy(false); }
        }}>
          <h2 className="display text-2xl">Change password</h2>
          <Field label="Current password" error={errs.cur} htmlFor="ac-cur"><TextInput id="ac-cur" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} invalid={!!errs.cur} /></Field>
          <Field label="New password" error={errs.next} hint="At least 8 characters" htmlFor="ac-new"><TextInput id="ac-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} invalid={!!errs.next} /></Field>
          <Field label="Repeat new password" error={errs.again} htmlFor="ac-again"><TextInput id="ac-again" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} invalid={!!errs.again} /></Field>
          {formErr ? <Notice tone="error">{formErr}</Notice> : null}
          {done ? <Notice tone="success">Password changed. Your other sessions have been signed out.</Notice> : null}
          <Button type="submit" busy={busy}>Change password</Button>
        </form>
      </section>
    </div>
  );
}
