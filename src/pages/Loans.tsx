import { useState } from 'react';
import { useData } from '../lib/useData';
import { Link, useRouter } from '../lib/router';
import { rs, bsText } from '../lib/format';
import { Chip, Demo, Empty, Notice, PageHead, SegTabs, Skeleton, Button } from '../components/ui';
import { useAuth as useAuth2 } from '../lib/auth';
import { IconPlus } from '../components/Icons';

interface LoanRow { id: number; memberName: string; memberNo: string; principal: number; annualRatePct: number; termMonths: number; emi: number; status: 'active' | 'closed'; purpose: string; disbursedAd: string; isDemo: boolean; summary: { principalOutstanding: number; overdueCount: number; overdueAmount: number; amountDue: number } }

export function Loans({ mine = false }: { mine?: boolean }) {
  const { user } = useAuth2();
  const memberFilter = mine && user?.memberId ? `&member_id=${user.memberId}` : '';
  const [status, setStatus] = useState<'all' | 'active' | 'closed'>('active');
  const { data, error, reload } = useData<{ loans: LoanRow[] }>(`/api/loans?status=${status}${memberFilter}`);
  const { navigate } = useRouter();
  const isOffice = !mine && user?.role === 'office';
  return (
    <div className="space-y-8">
      <PageHead kicker={mine ? 'My account' : 'Loans'} title={mine ? 'My loans' : 'Loans'}>
        {isOffice ? <Button onClick={() => navigate('/loans/new')}><IconPlus /> New loan</Button> : null}
      </PageHead>
      <div className="rise rise-2">
        <SegTabs label="Loan status" value={status} options={[{ value: 'active', label: 'Active' }, { value: 'closed', label: 'Closed' }, { value: 'all', label: 'All' }]} onChange={setStatus} />
      </div>
      {error ? <Notice tone="error">{error} <button className="btn btn-quiet" onClick={reload}>Try again</button></Notice> : null}
      {!data && !error ? <div aria-busy="true" aria-label="Loading loans"><Skeleton lines={5} /></div> : null}
      {data && data.loans.length === 0 ? <Empty title="No loans here">{status === 'active' ? 'No active loans right now.' : 'Nothing matches this filter.'}</Empty> : null}
      {data && data.loans.length > 0 ? (
        <ul className="ruled rise rise-3">
          {data.loans.map((l) => (
            <li key={l.id}>
              <Link to={mine ? `/passbook/loans/${l.id}` : `/loans/${l.id}`} className="grid gap-2 py-4 transition-colors hover:text-primary md:grid-cols-[1.6fr_1fr_1fr_auto] md:items-center md:gap-6">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{mine ? l.purpose : `${l.memberName} · ${l.purpose}`}{l.isDemo ? <span className="ml-2 align-middle"><Demo /></span> : null}</span>
                  <span className="block text-sm text-muted">{mine ? '' : `${l.memberNo} · `}Taken {bsText(l.disbursedAd)} · {l.termMonths} months at {l.annualRatePct}%</span>
                </span>
                <span className="num text-sm md:text-right"><span className="text-muted">Installment </span>{rs(l.emi)}</span>
                <span className="num text-sm md:text-right"><span className="text-muted">Outstanding </span><span className="font-semibold">{rs(l.summary.principalOutstanding)}</span></span>
                <span className="md:text-right">
                  {l.status === 'closed' ? <Chip tone="paid">Closed</Chip> : l.summary.overdueCount ? <Chip tone="overdue">{l.summary.overdueCount} overdue</Chip> : <Chip tone="open">On schedule</Chip>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

