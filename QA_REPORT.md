# Sahakari: QA report (Day 5)

Date: 2026-11-06, Nepal time. Target: https://sahakari.sites.tab.bot/ (the deployed build of this source). Environment: Node 22.23 for tests, headless Chromium (Playwright) for browser checks, Cloudflare Worker and D1 on the live site.

## 1. Automated tests (run on this source)

| Suite | Tests | Result |
|---|---|---|
| `api/test/money.test.ts`: amount parsing, lakh grouping, month arithmetic, reducing and flat schedules, rounding, allocation (in order, interest first), overdue, closure, savings balance, loan limit | 11 | 11 pass, 0 fail |
| `api/test/api.test.ts`: seed and demo logins; auth and role refusals; members seeing only themselves; dashboard totals; savings (deposit, overdraw refused, interest); loan limit, one-active-loan rule, schedule, payment checks, closure; member registration (code once, duplicate email); office password reset ends sessions; password change; settings validation and cross-site refusal; cash book totals and date range; audit trail; demo reset | 13 | 13 pass, 0 fail |
| **Total** | **24** | **24 pass, 0 fail** |

Typecheck: `tsc -p tsconfig.json` (app) and `tsc -p tsconfig.api.json` (Worker) both pass. Production build passes; the Worker bundles to 47 KB and the site to about 1.2 MB, most of it fonts.

## 2. Browser checks on the live site (Chromium, headless)

30 checks, 30 pass, 0 fail. Run file: `qa/qa-run1.json`. Screenshots are in `qa/`.

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | demo reset before QA | PASS | 200 200 |
| 2 | landing 360px no horizontal scroll | PASS | overflow 0px |
| 3 | landing 390px no horizontal scroll | PASS | overflow 0px |
| 4 | landing 768px no horizontal scroll | PASS | overflow 0px |
| 5 | landing 1440px no horizontal scroll | PASS | overflow 0px |
| 6 | wrong password shows plain message | PASS | Email or password is not right. |
| 7 | client validation on email | PASS |  |
| 8 | logged-out /members redirects to sign-in | PASS | https://sahakari.sites.tab.bot/sign-in?next=%2Fmembers |
| 9 | demo office lands on overview | PASS |  |
| 10 | overview shows DEMO badge | PASS |  |
| 11 | deposit increases savings balance | PASS | Rs. 13,500.00 -> Rs. 16,000.50 |
| 12 | overdraw refused in plain words | PASS | That withdrawal is more than the balance. Balance now: Rs. 16,000.50. |
| 13 | loan preview shows installment | PASS | Before you issue / Installment / Rs. 1,776.98 / Total interest / Rs. 1,323.70 / Total to r |
| 14 | loan issued and opens schedule | PASS | https://sahakari.sites.tab.bot/loans/4 |
| 15 | over-payment refused | PASS |  |
| 16 | payment recorded | PASS |  |
| 17 | cash book loads | PASS |  |
| 18 | audit shows loan.disbursed | PASS |  |
| 19 | office overview 390px no horizontal scroll | PASS | 0px |
| 20 | members 390px no horizontal scroll | PASS | 0px |
| 21 | member passbook loads | PASS |  |
| 22 | member is redirected away from /members | PASS | https://sahakari.sites.tab.bot/passbook |
| 23 | member on /loans is redirected | PASS | https://sahakari.sites.tab.bot/passbook |
| 24 | office creates member and sees SHK code | PASS | SHK-7KMF2J |
| 25 | member registers with code and lands on passbook | PASS |  |
| 26 | used code refused in plain words | PASS |  |
| 27 | office issues temporary password | PASS |  |
| 28 | old password refused after reset | PASS |  |
| 29 | temporary password signs the member in | PASS |  |
| 30 | wrong current password refused | PASS |  |

Console messages in the run: 2 kinds, both expected. A 401 on a wrong password, and a 422 on a reused membership code. Both are the server refusing bad input and the page showing the plain message. No JavaScript errors, no failed requests, no blocked resources.

## 3. Responsive coverage

| Surface | 360 px | 390 px | 768 px | 1440 px |
|---|---|---|---|---|
| Public page | checked, no sideways scroll | checked, no sideways scroll | checked, no sideways scroll | checked, no sideways scroll |
| Office overview | not checked | checked, no sideways scroll | not checked | checked (screenshot) |
| Members list | not checked | checked, no sideways scroll | not checked | checked (screenshot) |
| Member detail, loan detail, loan form, cash book, settings | not checked | not checked | not checked | checked (screenshots) |
| Member passbook | not checked | checked (screenshot) | not checked | not checked |

Gap, stated plainly: the app pages were not checked at 360 px or 768 px, and most office pages were checked on desktop only. The layouts use the same breakpoints, but this is not a full sweep.

## 4. Found in QA and fixed on this build

- The loan schedule table was cut off on desktop, with the Status column off-screen. The schedule now runs full width, with repayment panels below it.
- The six-month chart labelled two bars with the same month (AD months straddle Bikram Sambat months). The chart now uses Bikram Sambat months.
- The savings ledger table overflowed on phones. Phones now get a ruled list; the table stays for desktop.
- Amounts such as "Rs. 1,41,939.82" wrapped between "Rs." and the number. The space is now a non-breaking space.
- The logged-out check on the session call logged a 401 on every public page. It now returns a null user with 200.
- A reused membership code showed the same sentence twice. It now shows one plain sentence.
- The net-cash list under the chart wrapped badly on desktop. It is now a single ruled list, with negatives in the danger colour.

## 5. Not tested

- A real phone, or any iPhone or Android device. Checks ran in headless Chromium only.
- Email and SMS: nothing is sent, so there is nothing to test.
- Screen readers. Labels, roles and focus states are in place, but no assistive technology run was done.
- Automated accessibility scan (axe or Lighthouse): not run.
- Load: a few demo records only.
- The 360 px and 768 px app pages (see section 3).

## 6. Security checks done in code and by test

- Passwords: PBKDF2-SHA256, 100,000 iterations, per-user random salt, constant-time compare. Verified by the login tests.
- Sessions: random 32-byte token in an HttpOnly, Secure, SameSite=Lax cookie. Only its SHA-256 is stored. Logout, password change (other sessions) and office reset end sessions. Tested.
- Authorisation: member accounts are refused on other members' records, statements and loans (403). Office-only routes refuse members (403). Tested.
- Validation: amounts, dates, rates, terms, phone and email checked server-side. Tested for the main refusals.
- Writes: JSON only, same-origin only. A cross-site request is refused (403). Tested.
- Rate limits on sign-in (30 per IP and 10 per account in 15 minutes), registration and demo sign-in. Not tested to the limit.
- Headers: Content-Security-Policy (self only), frame denial, nosniff, referrer policy, permissions policy on every page and response.
- No secrets in the source. No API keys are used. The demo accounts have a random, unusable password hash and sign in through the demo route only.
