# Sahakari

Sahakari is a ledger for a savings and loan cooperative in Nepal. It keeps the members, their savings deposits and withdrawals, loans with repayment schedules, repayments, passbook statements, a cash book, and an audit trail. Dates are shown in Bikram Sambat with the AD date beside them. Amounts are in Nepali rupees with lakh grouping.

Live (staging): https://sahakari.sites.tab.bot/
Demo office: https://sahakari.sites.tab.bot/ then "Open the demo office". Demo data is invented and labelled DEMO.

Day 5 of the 100 Platforms build (see `../../LOG.md`).

## What it does

- **Members.** Add, edit, mark active or inactive. Member number, phone, address, nominee, joining date (BS and AD). Each member gets a membership code the office gives them.
- **Member logins.** A member creates a login with the code. The code works once. Members see only their own passbook, loans and account.
- **Savings.** Deposits, withdrawals and interest. A withdrawal that would take the balance below zero is refused. Interest is worked out on the current balance at the cooperative's savings rate for 1 to 12 months and is recorded as a book entry, not cash.
- **Loans.** The loan limit is the savings balance times a multiplier the office sets (default 3). One active loan per member. Reducing-balance or flat-rate interest. The schedule is built to the paisa, and the last installment absorbs rounding so the schedule closes at zero.
- **Repayments.** Each payment clears the oldest installment first, interest before principal within it. Installments past their date show as overdue with the amount. A payment above the amount due is refused. When the loan is paid in full it closes.
- **Passbook.** A member's savings ledger with running balance and every loan's status. Printable.
- **Cash book.** Cash in (deposits and repayments) and cash out (withdrawals and loans paid out) for any date range. Interest credited is shown separately and is not counted as cash.
- **Dashboard.** Members, savings held, loans outstanding, overdue amount and count, six months of cash in and out by Bikram Sambat month, loans with overdue installments, latest entries.
- **Settings and staff.** Cooperative name, registration number, savings rate, loan rate, loan multiplier. Office staff logins. Office-issued temporary passwords for members. Demo reset for the demo office.
- **Audit trail.** Every write is logged with the actor, the action, the target and the time.

## What it does not do

- It takes no payments online. Cash and a manual ledger are the only money it records.
- It sends no SMS, WhatsApp or email. No messaging provider is connected.
- It does not set rates, penalties or limits for the cooperative. Those are the office's to set under its bylaws.
- It has no self-service password reset by email. The office issues a temporary password.
- It is not a regulatory filing tool.

## Stack

- **Front end:** React 18, Vite 5, TypeScript 5.6, Tailwind CSS 3 with CSS variables for the palette, hand-written router and state (no UI kit). Fonts from `@fontsource`: Newsreader (headings), Public Sans (text), Noto Sans Devanagari (Nepali text).
- **Back end:** one Cloudflare Worker (`api/src/worker.ts`) over a D1 database. Routes under `/api/*`, the single-page app for everything else. Security headers are set on every response.
- **Auth:** PBKDF2-SHA256 with 100,000 iterations (WebCrypto). Sessions are random tokens; only their SHA-256 is stored. Cookie is HttpOnly, Secure, SameSite=Lax, 14 days.
- **Money:** integer paisa everywhere. Rates in basis points. No floats in the ledger.
- **Dates:** the shared Bikram Sambat conversion in `shared/nepali-date.js` (range 2000 to 2090 BS). Nepal time (UTC+05:45) for "today".
- **Shared logic:** `shared/money.ts` holds the schedule, allocation, balance and limit rules, used by both the Worker and the web app, so the preview on the loan form and the saved schedule are the same arithmetic.

## Layout

```
api/src/worker.ts      routes, auth, RBAC, validation, demo seed
api/src/schema.ts      D1 schema (tables, checks, indexes)
api/src/crypto.ts      PBKDF2, tokens, temporary passwords
api/test/              24 tests: money/schedule (11), API routes (13)
api/build.mjs          bundles the Worker and writes dist/site/tab-site.json (D1 binding DB)
shared/money.ts        paisa, schedule, allocation, limit (pure, tested)
shared/nepali-date.js  Bikram Sambat conversion
src/                   React app: pages/, components/, lib/
palette.json           the colour tokens and their contrast ratios
```

## Run and check

```
npm ci
npm test            # 24 tests, node:sqlite stand-in for D1
npm run build       # typecheck (app and worker), vite build, bundle the worker to dist/site
```

Deploy: `publish-cli.mjs site.publish` with `source_dir` set to `dist/site`. The `tab-site.json` it writes declares the D1 binding `DB`; the first publish creates the database and later publishes keep its data.

## Rules the software enforces

- Loan principal cannot exceed savings balance times the multiplier, and a member with an active loan cannot get another.
- Withdrawals cannot take the balance below zero. The check and the write are one statement.
- Payments cannot exceed the amount due.
- Inactive members cannot take new entries or loans.
- Member accounts see only their own member record, statement and loans. Server-side checks, not only the screens.
- Only office staff can change settings, create members, record entries, issue loans or see the audit trail.
- Writes must be JSON from the same origin.

## Demo

The demo office and demo member sign in without a password through the demo buttons. They use invented members (Sunita Rai, Bikash Thapa, Anita Gurung, Ram Bahadur Shrestha, Kamala Tamang), fictional entries and a fictional cooperative name. The demo office can reset the data. Anyone can open the demo, so the demo deployment must not hold real members. A real cooperative should run its own deployment with the demo accounts removed from `ensureReady`.

## Known limits

- One cooperative per deployment (one settings row).
- No CSV or PDF export of the cash book yet; the print view prints the passbook.
- Dashboard and statements are computed on request. Fine for hundreds of members and loans; not tuned for tens of thousands.
- Rate limits are D1 counters, which is approximate under heavy concurrency.
- No automatic interest posting or monthly standing deposits. The office records each entry.
- Only English labels, with Nepali name and Devanagari font support. The brief allowed Nepali labels; they are not done yet.
- Not tested on a real phone. Browser checks ran in headless Chromium at 390 px and 1440 px for the app and 360, 390, 768 and 1440 px for the public pages.

## Business notes (no numbers invented)

- **Who it is for:** the office of a savings and loan cooperative (sahakari) that keeps its books in a register, a spreadsheet or a vendor's desktop software, and its members who want to see their own passbook.
- **What exists already (search, not verified):** Sahakari Software (sahakarisoftware.com) describes cooperative banking software for sahakari institutions in Nepal; CoopSolve describes cooperative management software with deposits and loans; FinBanking (finbanking.fintechtechnology.com.np) describes a co-operative financial solution covering saving, share and loan transactions; a YouTube video lists a starting price of Rs. 35,000 for a cooperative software product. None of these prices or claims has been checked.
- **Possible revenue:** a yearly setup and support fee per cooperative, or a fixed monthly fee. Not priced here. Nothing is charged at present; revenue is $0 and expenses are $0.
- **What would make it win:** the passbook for members on their phone, Bikram Sambat dates everywhere, and the cash book kept apart from book entries.

## Licence

MIT (see package.json). Fonts are under the SIL Open Font License through `@fontsource`.
