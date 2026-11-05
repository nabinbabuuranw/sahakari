# Sahakari: 30-point anti-AI UI audit (Day 5)

Each point was checked against the live build (2026-11-06) and its source. "Pass" means the rule is not visible in the product. Where a point is met only in part, the entry says so.

| # | Rule | Result | Evidence |
|---|---|---|---|
| 1 | Harsh gradients | Pass | No gradients in the design. The only gradient is the loading shimmer on skeleton bars, which is a flat tint sweep. |
| 2 | Pure white backgrounds | Pass | Page #F6F1E3, surfaces #FCFAF3. No #FFFFFF background. |
| 3 | Rainbow colouring | Pass | Four palette colours plus neutrals: teal, cream, mustard, oxblood. |
| 4 | Heavy drop shadows | Pass | No card shadows. The only shadow is the sheet (dialog) lift. |
| 5 | Liquid glass | Pass, with a note | No glass panels. The sticky phone header and the bottom tab bar have a light translucent background with blur, which is a functional bar, not a decorative surface. |
| 6 | Generic purple and black | Pass | No purple. Black is not used as a theme colour. |
| 7 | Radial orbs | Pass | None. |
| 8 | Excessive neon | Pass | None. |
| 9 | Basic pastel palettes | Pass | Deep teal and oxblood carry the design, not pastels. |
| 10 | Default icon set | Pass | The nav glyphs are drawn for this app (`src/components/Icons.tsx`), not from a stock set. |
| 11 | Emojis as UI icons | Pass | None. Status uses text marks (check, dot, half circle, exclamation) inside chips. |
| 12 | Default Inter, Geist or Space Grotesk | Pass | Newsreader, Public Sans, Noto Sans Devanagari. |
| 13 | Unnecessary sparkle icons | Pass | None. |
| 14 | Animated arrows | Pass | No animated arrows. |
| 15 | Hover animation on every element | Pass | Only colour changes on buttons, links and table rows. No movement on hover. |
| 16 | Three-feature card layouts | Pass | The public page uses a ruled list for features. No card grid. |
| 17 | Coloured left stripes on cards | Pass | Highlight panels use a top rule, not a side stripe. |
| 18 | Repetitive bento grids | Pass | None. |
| 19 | Terminal mockups | Pass | None. |
| 20 | Three-tier pricing | Pass | No pricing on the site. |
| 21 | Soft rounded corners everywhere | Pass | Corners are 6 px. Chips are pills, used only for status. |
| 22 | Dot-grid backgrounds | Pass | None. |
| 23 | Excessive em dashes | Pass, with a note | Four em dashes, all as the placeholder in an empty table cell ("—"). No em dashes in copy. |
| 24 | "It's not X, it's Y" copy | Pass | Checked the public page and the app copy; none. |
| 25 | Repetitive checkmark bullet lists | Pass | The "What it does not do" list uses plain sentences, no check marks. |
| 26 | Fake testimonials | Pass | None. |
| 27 | Missing real product demos | Pass | A working demo office and a working demo passbook, with real flows. A worked loan example on the public page is computed live. |
| 28 | Missing skeleton loaders | Pass | Skeletons on every data page while it loads. |
| 29 | Missing Terms of Service | Pass | `/terms`, linked from the public page and the footer. Plain, short, and says the software holds no money. Not reviewed by a lawyer. |
| 30 | Missing Privacy Policy | Pass | `/privacy`, linked from the public page and the footer. Says what is stored, who sees it and the one cookie. Not reviewed by a lawyer. |

Result: 30 of 30 met; points 5 and 23 carry a note.
