import React from 'react';
import { Link, useRouter } from '../lib/router';
import { useAuth } from '../lib/auth';
import { IconBook, IconGear, IconHome, IconLedger, IconLoan, IconPeople } from './Icons';
import { Demo } from './ui';

const OFFICE_NAV = [
  { to: '/office', label: 'Overview', icon: IconHome, match: (p: string) => p === '/office' },
  { to: '/members', label: 'Members', icon: IconPeople, match: (p: string) => p.startsWith('/members') },
  { to: '/loans', label: 'Loans', icon: IconLoan, match: (p: string) => p.startsWith('/loans') },
  { to: '/cashbook', label: 'Cash book', icon: IconLedger, match: (p: string) => p.startsWith('/cashbook') },
  { to: '/settings', label: 'Settings', icon: IconGear, match: (p: string) => p.startsWith('/settings') },
];
const MEMBER_NAV = [
  { to: '/passbook', label: 'Passbook', icon: IconBook, match: (p: string) => p.startsWith('/passbook') },
  { to: '/passbook/loans', label: 'My loans', icon: IconLoan, match: (p: string) => p.startsWith('/passbook/loans') },
  { to: '/account', label: 'Account', icon: IconGear, match: (p: string) => p.startsWith('/account') },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { path, navigate } = useRouter();
  const isOffice = user?.role === 'office';
  const nav = isOffice ? OFFICE_NAV : MEMBER_NAV;
  const pathOnly = path.split('?')[0];
  return (
    <div className="min-h-screen md:flex">
      <aside className="no-print hidden w-[15.5rem] shrink-0 flex-col border-r border-line bg-surface md:sticky md:top-0 md:flex md:h-screen">
        <div className="px-6 pb-6 pt-7">
          <Link to={isOffice ? '/office' : '/passbook'} className="block">
            <span className="display block text-[1.7rem] leading-none">Sahakari</span>
            <span className="nep mt-1 block text-sm text-muted">सहकारी</span>
          </Link>
        </div>
        <nav aria-label="Main" className="flex-1 px-3">
          <ol className="space-y-0.5">
            {nav.map((n, i) => {
              const active = n.match(pathOnly);
              const Icon = n.icon;
              return (
                <li key={n.to}>
                  <a
                    href={n.to}
                    aria-current={active ? 'page' : undefined}
                    onClick={(e) => { e.preventDefault(); navigate(n.to); }}
                    className={`group flex min-h-[2.6rem] items-center gap-3 rounded-md px-3 text-[0.95rem] transition-colors ${active ? 'bg-primary text-white' : 'text-ink hover:bg-paper'}`}
                  >
                    <span className={`num w-5 text-xs ${active ? 'text-white/80' : 'text-muted'}`}>{String(i + 1).padStart(2, '0')}</span>
                    <Icon />
                    <span className="font-semibold">{n.label}</span>
                  </a>
                </li>
              );
            })}
          </ol>
        </nav>
        <div className="border-t border-line px-6 py-5">
          <p className="truncate text-sm font-semibold">{user?.name}</p>
          <p className="truncate text-xs text-muted">{isOffice ? 'Cooperative office' : 'Member'}</p>
          {user?.isDemo ? <div className="mt-2"><Demo /></div> : null}
          <button onClick={() => signOut().then(() => navigate('/'))} className="btn btn-quiet mt-3 px-0">Sign out</button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur md:hidden">
          <Link to={isOffice ? '/office' : '/passbook'} className="display text-2xl leading-none">Sahakari <span className="nep text-base text-muted">सहकारी</span></Link>
          <button onClick={() => signOut().then(() => navigate('/'))} className="btn btn-quiet">Sign out</button>
        </header>
        <main id="main" className="mx-auto w-full max-w-[64rem] flex-1 px-4 pb-28 pt-7 md:px-10 md:pb-16 md:pt-10">
          <div key={pathOnly} className="rise-2">{children}</div>
        </main>
        <nav aria-label="Main" className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur md:hidden">
          <ul className="grid grid-cols-5" style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0,1fr))` }}>
            {nav.map((n) => {
              const active = n.match(pathOnly);
              const Icon = n.icon;
              return (
                <li key={n.to}>
                  <a
                    href={n.to}
                    aria-current={active ? 'page' : undefined}
                    onClick={(e) => { e.preventDefault(); navigate(n.to); }}
                    className={`flex min-h-[3.6rem] flex-col items-center justify-center gap-0.5 text-[0.7rem] font-semibold ${active ? 'text-primary' : 'text-muted'}`}
                  >
                    <Icon />
                    <span>{n.label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
