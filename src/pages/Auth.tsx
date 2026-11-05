import React, { useState } from 'react';
import { Link, query, useRouter } from '../lib/router';
import { useAuth } from '../lib/auth';
import { post, ApiError, messageFor } from '../lib/api';
import { Button, Demo, Field, Notice, TextInput } from '../components/ui';

export function Auth({ mode }: { mode: 'sign-in' | 'register' }) {
  const { path, navigate } = useRouter();
  const { setUser } = useAuth();
  const next = query(path).get('next') || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState<string | null>(null);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) e.email = 'Enter an email address like name@example.com.';
    if (password.length < 8) e.password = 'Use at least 8 characters.';
    if (mode === 'register' && !/^SHK-[A-Za-z2-9]{6}$/.test(code.trim())) e.code = 'The code looks like SHK-XXXXXX, from your cooperative office.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setFormErr(null);
    if (!validate()) return;
    setBusy(true);
    try {
      const r = mode === 'sign-in'
        ? await post<{ user: any }>('/api/auth/login', { email: email.trim(), password })
        : await post<{ user: any }>('/api/auth/register', { member_code: code.trim().toUpperCase(), email: email.trim(), password, name: name.trim() });
      setUser(r.user);
      const dest = next && next.startsWith('/') && !next.startsWith('//') ? next : r.user.role === 'office' ? '/office' : '/passbook';
      navigate(dest, { replace: true });
    } catch (err) {
      setFormErr(err instanceof ApiError ? err.message : messageFor('server_error'));
    } finally {
      setBusy(false);
    }
  };

  const demo = async (role: 'office' | 'member') => {
    setDemoBusy(role);
    try {
      const r = await post<{ user: any }>('/api/auth/demo', { role });
      setUser(r.user);
      navigate(role === 'office' ? '/office' : '/passbook', { replace: true });
    } catch {
      setFormErr('The demo is not ready yet. Try again in a moment.');
    } finally {
      setDemoBusy(null);
    }
  };

  return (
    <div className="mx-auto grid min-h-screen max-w-[72rem] md:grid-cols-[1fr_1fr]">
      <div className="hidden flex-col justify-between bg-primary p-12 text-paper md:flex">
        <Link to="/" className="display text-2xl">Sahakari <span className="nep text-base opacity-80">सहकारी</span></Link>
        <div>
          <p className="display text-4xl leading-tight">Every entry has a date, a name and a reason.</p>
          <p className="mt-4 max-w-md opacity-85">Members see their own passbook and loan schedule. The office keeps the cash book and the audit trail.</p>
        </div>
        <p className="text-sm opacity-75">Dates appear in Bikram Sambat, with AD beside them.</p>
      </div>
      <div className="flex flex-col justify-center px-5 py-12 md:px-14">
        <div className="rise mx-auto w-full max-w-md">
          <Link to="/" className="display mb-8 block text-xl md:hidden">Sahakari</Link>
          <h1 className="display text-4xl">{mode === 'sign-in' ? 'Sign in' : 'Create your member login'}</h1>
          <p className="mt-2 text-muted">
            {mode === 'sign-in'
              ? 'Office staff and members use the same page.'
              : 'Enter the membership code your cooperative office gave you. It works once.'}
          </p>

          <form onSubmit={submit} noValidate className="mt-8 space-y-5">
            {mode === 'register' ? (
              <>
                <Field label="Membership code" hint="For example SHK-7KQ4MD" error={errors.code} htmlFor="code">
                  <TextInput id="code" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} invalid={!!errors.code} placeholder="SHK-XXXXXX" />
                </Field>
                <Field label="Your name" hint="Optional. The office name for you is used if you leave this empty." htmlFor="name">
                  <TextInput id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
              </>
            ) : null}
            <Field label="Email" error={errors.email} htmlFor="email">
              <TextInput id="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} invalid={!!errors.email} />
            </Field>
            <Field label="Password" hint={mode === 'register' ? 'At least 8 characters.' : undefined} error={errors.password} htmlFor="password">
              <TextInput id="password" type="password" autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} invalid={!!errors.password} />
            </Field>
            {formErr ? <Notice tone="error">{formErr}</Notice> : null}
            <Button type="submit" busy={busy} className="w-full">{mode === 'sign-in' ? 'Sign in' : 'Create login'}</Button>
          </form>

          <p className="mt-6 text-sm text-muted">
            {mode === 'sign-in' ? (
              <>New member? <Link to="/register" className="font-semibold text-primary underline underline-offset-4">Create your login with your code</Link>.</>
            ) : (
              <>Already have a login? <Link to="/sign-in" className="font-semibold text-primary underline underline-offset-4">Sign in</Link>.</>
            )}
          </p>
          {mode === 'sign-in' ? (
            <p className="mt-3 text-sm text-muted">Forgot your password? Ask the cooperative office. They can issue a temporary one.</p>
          ) : null}

          <div className="mt-10 border-t border-line pt-6">
            <p className="flex items-center gap-2 text-sm font-semibold"><Demo /> Try it without an account</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Button variant="ghost" onClick={() => demo('office')} busy={demoBusy === 'office'} disabled={!!demoBusy}>Demo office</Button>
              <Button variant="ghost" onClick={() => demo('member')} busy={demoBusy === 'member'} disabled={!!demoBusy}>Demo member</Button>
            </div>
            <p className="mt-3 text-sm text-muted">Every name in the demo is invented.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
