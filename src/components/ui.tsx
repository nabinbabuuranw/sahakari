import React, { useEffect, useId, useRef } from 'react';

export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'quiet'; busy?: boolean }) {
  const { variant = 'primary', busy, className = '', children, disabled, ...rest } = props;
  const cls = { primary: 'btn-primary', ghost: 'btn-ghost', danger: 'btn-danger', quiet: 'btn-quiet' }[variant];
  return (
    <button {...rest} disabled={disabled || busy} aria-busy={busy || undefined} className={`btn ${cls} ${className}`}>
      {busy ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function Spinner() {
  return (
    <span aria-hidden="true" className="spin-dot inline-block h-4 w-4 rounded-full border-2 border-current border-r-transparent" />
  );
}

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: string; error?: string | null; children: React.ReactNode; htmlFor?: string }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">{label}</label>
      {children}
      {hint && !error ? <p id={hintId} className="text-sm text-muted">{hint}</p> : null}
      {error ? <p id={errId} role="alert" className="text-sm font-medium text-danger">{error}</p> : null}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  const { invalid, className = '', ...rest } = props;
  return <input {...rest} aria-invalid={invalid || undefined} className={`field ${className}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  const { invalid, className = '', children, ...rest } = props;
  return (
    <select {...rest} aria-invalid={invalid || undefined} className={`field ${className}`}>
      {children}
    </select>
  );
}

export function Chip({ tone, children }: { tone: 'paid' | 'open' | 'partial' | 'overdue' | 'demo'; children: React.ReactNode }) {
  const icon = { paid: '✓', open: '•', partial: '◐', overdue: '!', demo: '' }[tone];
  return (
    <span className={`chip chip-${tone}`}>
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {children}
    </span>
  );
}

export function Demo() {
  return <span className="chip chip-demo" title="Fictional demo data, not a real member">Demo</span>;
}

export function Skeleton({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton h-5" style={{ width: `${92 - i * 11}%` }} />
      ))}
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success'; children: React.ReactNode }) {
  const color = tone === 'error' ? 'text-danger border-danger' : tone === 'success' ? 'text-success border-success' : 'text-ink border-line';
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`border-l-4 bg-surface px-4 py-3 text-[0.95rem] ${color} fade`}>
      {children}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="py-10 text-center">
      <p className="display text-xl">{title}</p>
      {children ? <div className="mt-2 text-muted">{children}</div> : null}
    </div>
  );
}

export function PageHead({ kicker, title, children }: { kicker?: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="rise flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
      <div>
        {kicker ? <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{kicker}</p> : null}
        <h1 className="display mt-1 text-[2.1rem] leading-[1.08] md:text-[2.6rem]">{title}</h1>
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </header>
  );
}

export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => panel.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus(), 30);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6 fade" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} className="rise max-h-[92vh] w-full overflow-y-auto rounded-t-xl border border-line bg-paper shadow-sheet sm:max-w-xl sm:rounded-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id={titleId} className="display text-2xl">{title}</h2>
          <button onClick={onClose} className="btn btn-quiet" aria-label="Close">Close</button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

export function SegTabs<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-md border border-line bg-surface p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-[2.25rem] rounded px-3 text-sm font-semibold transition-colors ${value === o.value ? 'bg-primary text-white' : 'text-muted hover:text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: 'danger' | 'success' }) {
  return (
    <div className="min-w-0 px-4 py-4 first:pl-0 md:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className={`display num mt-1.5 text-[1.6rem] leading-tight md:text-[1.9rem] ${tone === 'danger' ? 'text-danger' : ''}`}>{value}</p>
      {sub ? <p className="mt-1 text-sm text-muted">{sub}</p> : null}
    </div>
  );
}

