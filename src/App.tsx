import React, { useEffect } from 'react';
import { RouterProvider, useRouter, matchPath, query } from './lib/router';
import { AuthProvider, useAuth } from './lib/auth';
import { Shell } from './components/Shell';
import { Skeleton } from './components/ui';
import { Landing } from './pages/Landing';
import { Auth } from './pages/Auth';
import { Overview } from './pages/Overview';
import { Members } from './pages/Members';
import { MemberDetail } from './pages/MemberDetail';
import { Statement } from './pages/Statement';
import { Loans } from './pages/Loans';
import { LoanNew } from './pages/LoanNew';
import { LoanDetail } from './pages/LoanDetail';
import { Cashbook } from './pages/Cashbook';
import { Settings } from './pages/Settings';
import { Account } from './pages/Account';
import { Legal } from './pages/Legal';

type Role = 'office' | 'member';
interface Route { pattern: string; role?: Role; render: (p: Record<string, string>) => React.ReactNode; shell?: boolean }

const ROUTES: Route[] = [
  { pattern: '/', render: () => <Landing /> },
  { pattern: '/sign-in', render: () => <Auth mode="sign-in" /> },
  { pattern: '/register', render: () => <Auth mode="register" /> },
  { pattern: '/terms', render: () => <Legal which="terms" /> },
  { pattern: '/privacy', render: () => <Legal which="privacy" /> },
  { pattern: '/office', role: 'office', shell: true, render: () => <Overview /> },
  { pattern: '/members', role: 'office', shell: true, render: () => <Members /> },
  { pattern: '/members/:id', role: 'office', shell: true, render: (p) => <MemberDetail id={Number(p.id)} /> },
  { pattern: '/members/:id/statement', role: 'office', shell: true, render: (p) => <Statement memberId={Number(p.id)} /> },
  { pattern: '/loans', role: 'office', shell: true, render: () => <Loans /> },
  { pattern: '/loans/new', role: 'office', shell: true, render: () => <LoanNew /> },
  { pattern: '/loans/:id', role: 'office', shell: true, render: (p) => <LoanDetail id={Number(p.id)} /> },
  { pattern: '/cashbook', role: 'office', shell: true, render: () => <Cashbook /> },
  { pattern: '/settings', role: 'office', shell: true, render: () => <Settings /> },
  { pattern: '/passbook', role: 'member', shell: true, render: () => <Statement /> },
  { pattern: '/passbook/loans', role: 'member', shell: true, render: () => <Loans mine /> },
  { pattern: '/passbook/loans/:id', role: 'member', shell: true, render: (p) => <LoanDetail id={Number(p.id)} /> },
  { pattern: '/account', shell: true, render: () => <Account /> },
];

function Routed() {
  const { path, navigate } = useRouter();
  const { user, ready } = useAuth();
  const pathOnly = path.split('?')[0];
  const found = ROUTES.map((r) => ({ r, p: matchPath(r.pattern, pathOnly) })).find((x) => x.p);
  const route = found?.r;
  const params = found?.p ?? {};
  const needsRole = route?.role ?? (route?.shell ? 'any' : null);

  useEffect(() => {
    if (!ready || !route) return;
    if (route.shell && !user) {
      navigate(`/sign-in?next=${encodeURIComponent(path)}`, { replace: true });
      return;
    }
    if (route.role && user && user.role !== route.role) {
      navigate(user.role === 'office' ? '/office' : '/passbook', { replace: true });
    }
  }, [ready, route, user, path, navigate]);

  if (!ready) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16" aria-busy="true" aria-label="Loading">
        <Skeleton lines={4} />
      </div>
    );
  }
  if (!route) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24">
        <p className="display text-4xl">Page not found</p>
        <p className="mt-3 text-muted">The page you asked for is not here. <a className="font-semibold text-primary underline" href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }}>Back to the start</a>.</p>
      </div>
    );
  }
  if (route.shell) {
    if (!user) return null;
    if (route.role && user.role !== route.role) return null;
    return <Shell>{route.render(params)}</Shell>;
  }
  void needsRole;
  return <>{route.render(params)}</>;
}

export function App() {
  return (
    <RouterProvider>
      <AuthProvider>
        <Routed />
      </AuthProvider>
    </RouterProvider>
  );
}

export { query };
