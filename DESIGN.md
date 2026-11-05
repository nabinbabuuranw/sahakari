# Sahakari: design notes

## Palette (Nabin's standing rule: Coolors, one fresh palette per project)

- Source: https://coolors.co/335c67-fff3b0-e09f3e-9e2a2b-540b0e
- Name on Coolors: a popular palette, read from coolors.co/palettes/popular on 2026-11-06 without logging in.
- Source colours: #335C67 (deep teal), #FFF3B0 (pale yellow), #E09F3E (mustard), #9E2A2B (oxblood), #540B0E (maroon).
- Not used by any earlier project in `files/palettes_log.md`.
- Deviation, stated plainly: the palette was not picked from Nabin's logged-in Coolors account. The browser worker that was queued for it never started, and the public popular list gave what was needed. If Nabin wants the login-based pick, it can be redone; the tokens are in `palette.json` and change in one place (`src/styles.css`).

Derived tokens (the brief allows adjustment for contrast only):

| Token | Hex | Where it comes from |
|---|---|---|
| paper (page) | #F6F1E3 | a tint of #FFF3B0 pulled toward cream, so the page is not yellow and not white |
| surface (cards, fields) | #FCFAF3 | a lighter cream |
| ink (text) | #1C2A2E | #335C67 darkened |
| muted (secondary text) | #5A5F5C | neutral grey-green |
| line (rules) | #D9D1BC | warm hairline |
| primary (buttons, paid, bars) | #335C67 | palette |
| primary hover | #284A53 | palette, darkened |
| primary soft | #E4ECEC | palette at about 15 % |
| accent (bars, graphics) | #E09F3E | palette |
| accent text | #8A5514 | mustard darkened; #E09F3E itself is 3.35:1 on paper and fails text |
| danger (overdue) | #9E2A2B | palette |
| danger soft | #F5E1DF | oxblood at about 12 % |

Contrast (WCAG 2.x, computed with the relative-luminance formula):

| Pair | Ratio | AA text |
|---|---|---|
| ink on paper | 13.11 | pass |
| ink on surface | 14.16 | pass |
| muted on paper | 5.77 | pass |
| muted on surface | 6.23 | pass |
| white on primary | 7.32 | pass |
| primary on paper | 6.49 | pass |
| danger on paper | 6.60 | pass |
| accent text on paper | 5.49 | pass |
| accent text on surface | 5.93 | pass |
| ink on primary soft | 12.33 | pass |
| danger on danger soft | 5.93 | pass |
| white on primary hover | 9.57 | pass |

## Type

- Newsreader for headings and figures in the summary strips (a text serif with real optical sizes; the figures are tabular).
- Public Sans for text and tables.
- Noto Sans Devanagari for the Nepali name.
- Tabular numerals on every amount so columns line up.

## Layout

- Office: a left index rail with numbered sections (01 Overview to 05 Settings), a page heading with a rule under it, and ruled lists in place of boxed cards. Phones get a bottom tab bar.
- Overview: four figures separated by hairlines, a six-month cash chart in Bikram Sambat months, loans with overdue installments, latest entries.
- Loan form: the form on the left, a live preview of the schedule on the right, using the same arithmetic the Worker saves.
- Passbook: the member's statement, with a print view.
- Public page: an editorial headline, a worked example computed from the same arithmetic, a ruled list of what it keeps and what it does not do. No feature cards, no testimonials, no pricing tiers.

## Motion

- Route change: content rises 8 px and fades in over 420 ms. Staggered by section.
- Bar chart: bars grow from the baseline once.
- Sheets (dialogs): fade and rise. Escape closes; focus moves in and returns.
- Skeleton shimmer while loading.
- All of it is off under `prefers-reduced-motion`.

## Skills and references used

- UI UX Pro Max (`~/.agents/skills/ui-ux-pro-max`): `search.py "savings loan cooperative management finance Nepal members staff trust" --design-system`. It suggested a glassmorphism style with a blue-green palette. Not adopted: glass effects are on the list of things to avoid in the 30-point audit, and the palette above is Nabin's Coolors rule. The typography and the accessibility checklist from the run were kept (focus states, 4.5:1 text, reduced motion, 375/768/1024/1440 widths).
- 21st.dev (`21st search`): searched "savings ledger table", "loan repayment schedule", "cooperative member passbook statement". Results were used as references for the table and dialog patterns. No component code was copied or installed.

## What was checked against the brief

- Desktop and phone layouts checked in a headless browser (see QA_REPORT.md).
- No purple, no gradients beyond the loading shimmer, no pure white, no stock photos, no icons from a default set (the nav glyphs are drawn for this app).
