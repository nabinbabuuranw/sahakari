import { Link } from '../lib/router';

const UPDATED = '6 November 2026';

export function Legal({ which }: { which: 'terms' | 'privacy' }) {
  return (
    <div className="mx-auto max-w-[44rem] px-5 py-12 md:py-16">
      <Link to="/" className="display text-xl">Sahakari</Link>
      {which === 'terms' ? (
        <article className="rise mt-8 space-y-5 text-[1.02rem] leading-relaxed">
          <h1 className="display text-4xl">Terms of use</h1>
          <p className="text-sm text-muted">Last updated {UPDATED}</p>
          <p>Sahakari is a record-keeping tool for savings and loan cooperatives. It keeps the members, savings, loan and cash entries that your cooperative's office enters. It does not hold money, move money or accept payments.</p>
          <h2 className="display pt-2 text-2xl">Who is responsible for the entries</h2>
          <p>The cooperative and the office staff who sign in are responsible for what they enter, including rates, limits, penalties and the cash they record. The software records what was entered and shows the arithmetic; it does not check your bylaws.</p>
          <h2 className="display pt-2 text-2xl">Accounts</h2>
          <p>Office accounts are issued by the cooperative. Member accounts are created with a code issued by the office. Keep your password private. The office can issue a temporary password and end your sessions if needed.</p>
          <h2 className="display pt-2 text-2xl">Demo</h2>
          <p>The demo office and demo member use invented names and transactions. Demo data can be reset at any time and is not a record of anyone's money.</p>
          <h2 className="display pt-2 text-2xl">No warranty</h2>
          <p>The software is provided as it is. Keep your own paper or export records of anything that matters, and check the figures against your cash box and passbooks before you rely on them.</p>
          <h2 className="display pt-2 text-2xl">Changes</h2>
          <p>These terms may change. The date at the top shows the latest version.</p>
        </article>
      ) : (
        <article className="rise mt-8 space-y-5 text-[1.02rem] leading-relaxed">
          <h1 className="display text-4xl">Privacy notice</h1>
          <p className="text-sm text-muted">Last updated {UPDATED}</p>
          <h2 className="display pt-2 text-2xl">What is stored</h2>
          <p>For members: name, phone number, address, nominee details, joining date, membership number and the cooperative's own entries for savings and loans. For sign-in: email address and a salted, hashed password. Passwords are never stored as text.</p>
          <h2 className="display pt-2 text-2xl">Who can see it</h2>
          <p>Office staff see all members. A member sees only their own record, passbook and loans. Every change by office staff is logged with the person's email and the time.</p>
          <h2 className="display pt-2 text-2xl">Cookies</h2>
          <p>Sahakari uses one cookie to keep you signed in. It is HTTP-only and expires after 14 days or when you sign out. It is the only cookie the app sets.</p>
          <h2 className="display pt-2 text-2xl">Sharing</h2>
          <p>Nothing is sent to other companies. The app has no advertising, analytics or payment providers connected.</p>
          <h2 className="display pt-2 text-2xl">Requests</h2>
          <p>Ask your cooperative office to correct or remove your record. The office can also reset your password or end your sessions.</p>
        </article>
      )}
    </div>
  );
}
