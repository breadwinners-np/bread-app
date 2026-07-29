# Decision log

Why things are the way they are. Newest at the top.

This file is the shared memory for everyone working on this repo — both teammates
and Claude Code. If you make a call that a teammate would otherwise have to guess
at or re-litigate later, add an entry. Update it **in the same pull request as
the change it describes**, so the reasoning arrives with the code. A decision
with no code attached gets its own small docs-only pull request — see 0007.

Status values: **Proposed** (awaiting a teammate's agreement) · **Accepted** ·
**Superseded by NNNN** · **Rejected**.

Keep entries short. Context, the decision, the tradeoff. Do not rewrite history —
if a decision changes, add a new entry and mark the old one superseded.

---

## Open questions

Business rules we do not know yet. Anything here is a **blocker for schema work**,
not a detail to resolve later. Answers go into a dated entry below.

Each question carries a stable identifier, because the code and the subagents
cite them by identifier (`ORD-3`, `PAY-3`, …). If you add a question, give it one.

- **Who carries the offline delivery checklist? (DST-6)** Offline-first is
  required for distribution on the road, but the mobile app is described as the
  buyer app. Is the driver a role inside the buyer app, a separate surface, or
  does the owner travel with the laptop? Determines the whole sync architecture.
- **How does a monthly wholesale commitment become daily deliveries? (ORD-3)**
  Equal split across the month, or a per-day quantity stated by the customer?
  What happens to a month-end shortfall — carried, forgiven, or re-billed?
- **Cheque lifecycle (PAY-3).** Is a cheque "paid" on receipt or on clearing? Do
  we need received → deposited → cleared → bounced? A customer's balance means
  something different at each step.
- **Credit terms (PAY-6).** Do wholesale customers pay up front or in arrears?
  Are partial payments allowed? Can a balance go negative, and up to what limit?
- **Which bread a lump sum pays for (PAY-7).** A monthly cheque covers many days
  of bread. The code puts it against the oldest unpaid delivery first, which is
  the ordinary rule, but nobody has confirmed it is hers. It changes which
  delivery shows as paid, never the total owed. See 0013.
- **Pricing (PRD-4).** One price list, or a negotiated price per wholesale
  customer?
- **The bread list (PRD-5).** Which types does she actually sell, and what does
  each cost? The prototype's sugar / tea / butter bread is fabricated. See 0010 —
  a reverted commit claimed the real four are sugar, butter, mixfruit and brown,
  which is unconfirmed.
- **Several breads on one order (ORD-12).** Does a single order routinely carry
  more than one type of bread, and does a short drop need to say *which* bread
  was short? The prototype assumes one type per order. See 0010.
- **Unsold or refused bread (DST-7).** Does a short or refused drop reduce what
  is owed? Do we track waste as a cost?
- **Rescheduling (RSC-1).** When a failed delivery is moved to a later day, is it
  the same obligation moved, or a fresh one? The prototype moves the order so
  nothing is billed twice, but if the customer is charged for the failed attempt
  *and* the replacement, that is wrong — and it depends on the answer above.
- **Rescheduling history (RSC-2).** Should each attempt survive as its own
  record? The prototype keeps only the latest state plus the original date, so a
  drop that failed three times shows one move, not three. If the owner needs to
  see a customer who is repeatedly unreachable, this has to change.
- **Giving up (RSC-3).** Is there a point where a repeatedly-failed delivery is
  written off rather than moved again, and does the bread count as waste then?
- **Part deliveries (RSC-4).** If 45 of 60 loaves were taken, is the remaining 15
  a delivery to redeliver, or gone? The prototype deliberately leaves part
  deliveries out of "needs attention" rather than assume.
- **Cost granularity (CST-3).** Gas, ingredients, and transport as daily lump sums, or
  allocated per batch for profit-per-loaf? Does profit include wages?
- **Stock on hand (INV-1).** The system records what was bought, not what is
  left. Knowing the remaining stock means recording how much of each supply goes
  into a bake, which nobody does today. Does the owner want that, or is purchase
  history enough? Real stock tracking is a much larger feature and would need her
  to weigh bread against ingredients every day.
- **Supply catalogue (INV-2).** Items are a fixed list (flour, yeast, butter,
  sugar, salt, gas). Does the owner need to add her own, and should buying
  something new create the item on the fly?
- **Price changes (INV-3).** Purchases record the price paid each time, so a
  supplier's price rising is visible in the history. Does she want to be warned
  when a price moves, and by how much?
- **Phone OTP budget (AUTH-3).** Supabase phone auth needs an SMS provider billed
  per message in Ghana. Is there a budget, or should admin use email + password?
- **Owner-entered orders (ORD-11).** Confirming the assumption that admin can
  create an order for a customer who phones in and never installs the app.
- **Tax (TAX-1).** Do receipts and invoices need Ghana VAT and levies, or is this
  informal for v1?

Working defaults unless told otherwise: English only, dates `DD/MM/YYYY`,
Africa/Accra is UTC+0 with no daylight saving, business day is midnight to
midnight local.

---

## 0018 — The buyer app targets iOS as well as Android

**Date:** 2026-07-30 · **Status:** Proposed

Earlier docs said "Android first, iOS later", which in practice reads as "iOS
maybe never". The owner has customers on iPhones, so a buyer app that only runs
on Android leaves paying customers on the phone-and-text channel indefinitely.
Both platforms are now supported targets.

**This costs almost nothing in code, and something real in release process.**
Expo and React Native are already cross-platform, and nothing in `apps/mobile`
exists yet to port — the app has not been started. What iOS actually adds is a
Mac with Xcode, an Apple Developer Program membership at $99/year, and App Store
review standing between a fix and the customer holding the phone. Android has no
review queue and can be sideloaded as an APK for a pilot customer.

**So: build for both, release Android first.** Not because iOS is second class,
but because Android is most of the customer base in Accra, and because shipping
to one Baatsonaa Total pilot on Android validates offline sync and OTP auth
before we pay for a developer account. Every screen, dependency, and native
module gets chosen so it runs on both from the day it is written. No Android-only
native modules, no Android-only assumptions in layout or permissions flows.

**Open cost we have not priced:** PowerSync (0006) needs a custom dev build and a
physical device on each platform, so offline sync now has to be exercised on a
real iPhone too, not only a real Android handset.

**Tradeoff:** iPhone customers wait for the second release, and the team carries
Apple's yearly fee and review latency from that point on. Accepted, because the
alternative is a permanent gap in who can use the app.

## 0017 — Reports say "profit", and the day table reads newest first

**Date:** 2026-07-29 · **Status:** Proposed · **Asked for by the owner's daughter**

Revenue less costs was labelled **Left over** everywhere it appeared — a stat
tile, a table column, and the written summary. It is now **Profit before wages**,
and **Loss before wages** when it is negative, in which case the summary says so
in words rather than printing a minus sign and leaving her to notice it.

"Left over" was chosen to avoid claiming an accounting term the number does not
earn: it does not subtract wages, and whether costs should be spread across the
days a supply is used is still open (CST-3). But it read as loose change rather
than as the number the business runs on, which understates it in the other
direction.

**The caveat is in the label, not under it.** "Profit" on its own invites her to
read it as money she can take home, and a hint underneath is the first thing a
reader skips. Naming it in full costs three words and cannot be misread. If
wages ever enter the costs, the label loses its second half and nothing else
changes.

Separately, "Show the numbers" lists days **newest first**. She is nearly always
looking for what just happened. The chart above it stays in time order — a chart
that ran right to left would be unreadable.

## 0016 — Orders and deliveries are read as a month, not as a list

**Date:** 2026-07-29 · **Status:** Proposed · **Asked for by the owner's daughter**

Orders opened as one long list of every order ever written down, newest first,
and deliveries could only be reached a day at a time through previous/next
arrows. Both now lead with a **month calendar**: each day shows what is going
out on it, and tapping a day opens that day.

The question these two screens actually get asked is "what is happening on that
day" — by the owner planning the week, and by whoever stands in for her when she
is not there. A list answers "find me one order", which is the rarer question,
so it stays as a second tab on Orders rather than disappearing.

The deliveries calendar carries a day's progress in words — *All done*, *4 still
to do*, *1 could not be delivered* — so an unfinished day is visible without
opening it. Colour repeats what the words already say and never carries it alone.

One `MonthCalendar` component serves both screens: it knows about days, links,
and a two-line summary, and nothing about bread. Each screen decides what its
days count. The grid maths (`calendarWeeks`, `addMonths`) is pure and lives in
`packages/shared`, so the phone app gets the same calendar for free.

**Tradeoff:** a month view invites the question of what a *month* means for a
wholesale customer who agrees a monthly quantity — which is still ORD-3, still
unanswered, and this deliberately does not pretend to answer it. The calendar
counts the day-by-day orders that exist today.

## 0015 — The admin app is shaped around the owner, not around the data

**Date:** 2026-07-28 · **Status:** Proposed

The prototype was already large-buttoned and light-only. This goes further, on
the grounds that the only person who will ever use this screen is around fifty,
not technical, and will be reading it at speed early in the morning.

**Navigation is grouped and renamed.** Eight flat sidebar items became seven
under three headings — *Each day*, *Money*, *Records* — each with a line of
plain English under it. Labels say what she gets rather than what the table is
called: "Money in" rather than "Payments", "Money out" rather than "Inventory".

**Inventory and Costs merged into one screen at `/spending`.** They were two
destinations for one question — what did I spend? — and one of them carried a
permanent "soon" badge in the sidebar, which reads as broken software. The old
paths redirect; the redirects can be dropped once nobody is used to them.

**Consequential actions ask first, ordinary ones do not.** "Could not deliver",
recording a part delivery, and saying a customer's reported payment never
arrived now open a panel that states the consequence in her words and asks. The
delivery round's ordinary outcome — delivered in full — stays one click, because
she does it dozens of times a morning and a confirmation there would be a tax on
the common path rather than a safety net. Submits also disable while saving, so
an impatient second click cannot double-record.

**Part deliveries no longer default to the full amount.** The quantity box sat
pre-filled with everything ordered, next to a "Part delivered" button; pressing
it without editing recorded a "partial" delivery of the whole order. The box is
now empty, required, and capped below the ordered amount.

**The open questions on each screen are now addressed to her.** Every screen
used to end in an amber box citing identifiers — "still an open question
(DST-6)". The uncertainty is real and worth showing her, since the prototype
exists partly to provoke these answers, but she should meet it as a question she
can answer rather than as engineering shorthand. The identifiers stay in this
file, which is where a teammate looks them up.

**Accessibility lives in one place, not in every component.** The first attempt
at this scaled almost every element up — `text-lg` and `text-xl` everywhere,
2px borders, saturated fills — on the reasoning that a fifty-year-old needs
things big. The result was crowded and read as a student project: when
everything is emphasised, nothing is, and the hierarchy that actually helps her
find the number she wants disappears.

What replaced it: the base font is 18px in `globals.css`, so everything measured
in rem follows from one line, and components stay at `text-base` unless they are
a heading or a headline number. Secondary text is stone-600 (7:1 on white) or
stone-500 (4.6:1) by role rather than bolded. The primary button is near-black
(16:1) rather than a saturated amber (3.1:1), which is both quieter and far more
legible; amber survives as the focus ring, where it has to contrast against that
near-black button. Stat tiles lost their boxes — four bordered rectangles in a
row, and space separates them just as well. No number is described by colour
alone: a red balance always has "they owe you" written beside it.

**The charts were left alone.** Their two series colours were revalidated
(ΔE 24.7 protanopia, 33.6 normal vision, all six checks pass) and kept. Only the
chrome around them — legend, caption, grid — was quietened. A validated palette
is not something to restyle for taste.

**Tradeoff:** the confirmation panels are client components, so this part of the
delivery screen no longer works with JavaScript disabled. That was already true
of every form on the site via `useActionState`, and the app runs on one laptop,
so the cost is theoretical. The larger cost is that none of this has been in
front of the owner yet — it is a considered guess at what she needs, and the
first session watching her use it should be treated as the real test.

## 0014 — Reports draw their own SVG; Recharts is deferred

**Date:** 2026-07-28 · **Status:** Proposed

The reports page renders its charts as plain SVG from a server component
(`apps/admin/components/charts.tsx`). CLAUDE.md names Recharts as the intended
charting library and this does not use it.

Two forms are needed today — paired columns for money in against money out, and
ranked horizontal bars — both static, both readable on the server with no
client bundle at all. Recharts would add a dependency and push those pages into
client components to draw pictures that do not move.

**This is a deferral, not a rejection.** The moment the owner wants to hover for
a breakdown, brush a date range, or toggle a series, hand-rolled SVG stops being
the cheap option and Recharts should replace these two components. The rest of
the page does not change: the report itself is computed in
`packages/shared/src/reports.ts` and knows nothing about how it is drawn.

The two series colours are checked for colour-blind separation rather than
chosen by eye (ΔE 24.7 under protanopia against white, where 8 is the floor).
Every value in the chart is also in the table underneath it, so nothing is
readable only by colour or only on hover.

## 0013 — A payment a customer reports is a claim until the owner confirms it

**Date:** 2026-07-28 · **Status:** Proposed

The buyer app will let a customer tap to say they have paid. That arrives as a
`Payment` with `source: "app"` and no `confirmedAt`, appears on the owner's
payments screen under "customers say they have paid", and **counts for nothing**
— not against their balance, not in the day's takings, not in a report — until
she presses "Yes, it arrived".

A customer's word is information, not money. The alternative, letting a tap
reduce a balance, means anyone can clear their own debt from their phone. The
cost is a step of work for her per claim; that step is the whole point.

The buyer app does not exist yet. What exists is the seam it will arrive
through: `paymentClaimSchema` in `packages/shared`, `recordPaymentClaim()` in
the admin payment service, and one seeded example so the confirm flow is
visible. Nothing calls it.

**Also decided here:** a payment can be tied to one order, or left on the
account. One tied to an order pays that order first; anything left over, and any
untied lump sum, settles the oldest unpaid delivery first. That ordering is
PAY-7 and is unconfirmed — it only ever changes which delivery is shown as
settled, never the total.

## 0012 — An order is owed once it has been delivered

**Date:** 2026-07-28 · **Status:** Proposed

A customer's balance counts bread that has actually reached them. An order
scheduled for tomorrow is *expected*, not *owed*, and shows separately as
"coming up". Before this, the balance counted every non-cancelled order, so a
customer appeared to owe money for bread that had not been baked.

Revenue in reports uses the same rule, on the same day, so "earned" and "owed"
can never disagree.

**The provisional part:** a part delivery is owed for what actually arrived —
45 of 60 loaves is billed as 45. Whether a short drop reduces what the customer
owes is open (DST-7), and this is a guess at it. It errs toward not charging for
bread nobody received, because that is the less damaging way to be wrong with a
customer standing in front of you. A failed delivery is owed nothing at all;
when it is rescheduled, the same order becomes owed on the day it lands.

All of it lives in `orderAmountDuePesewas` in `packages/shared/src/payments.ts`.
If the owner says a short drop is still charged in full, that function is the
only thing that changes.

## 0011 — Open questions carry stable identifiers

**Date:** 2026-07-28 · **Status:** Proposed

The code and both subagents cite open questions by identifier — `ORD-3` in
`types.ts`, `DST-7` in `orders.ts`, `PAY-3` on the customers screen, and a fixed
list inside `.claude/agents/spec-guard.md`. Until today the Open questions
section above carried no identifiers at all, so none of those references
resolved to anything. They are now labelled, matching the identifiers already in
use. `PRD-5` and `ORD-12` are new (see 0010).

Nothing was reworded, only labelled. Add an identifier when you add a question.

## 0010 — Orders stay one bread type each, for now

**Date:** 2026-07-26 · **Status:** Proposed · **Backfilled 2026-07-28**

Commit `7f0e0ad` made an order carry several bread types: quantities per line
across the order form, the delivery screen and customer history, `Delivery`
losing its single `deliveredQuantity` in favour of per-line amounts, and the
product list replaced with sugar, butter, mixfruit and brown. It was reverted the
same evening in `d0630ad`. The code is back to one bread type per order, one
total quantity per delivery, and the fabricated sugar / tea / butter list.

**The reason for the revert was never written down.** This entry records what
happened, not why — whoever reverted it should say, because the same work will
otherwise be rebuilt and reverted again.

Two things surfaced in that commit and were lost with it, and both are now open
questions above rather than sitting only in a reverted diff:

- The commit stated the real bread types are **sugar, butter, mixfruit and
  brown**, not the prototype's sugar / tea / butter. If that came from the owner
  it is business fact and the prototype is wrong today (PRD-5).
- Whether one order routinely carries several types, and whether a short drop
  needs to record which bread was short, is undecided (ORD-12). It interacts with
  DST-7: attributing a shortfall only matters if a shortfall changes what is owed.

The same revert also stopped tracking `.claude/settings.local.json`, which is
per-machine Claude Code permissions committed by mistake, and added it to
`.gitignore` so it cannot conflict between teammates.

## 0009 — The admin prototype has no authentication

**Date:** 2026-07-25 · **Status:** Accepted

The skeleton has no login and no session. Every screen and every server action is
open to anyone who can reach the server.

This is acceptable only because the app holds nothing but fabricated sample data
and runs on one laptop. It stops being acceptable the moment a real customer name
or a real cheque number is entered.

**Before this touches real data:** admin authentication, and an authorization
check inside every server action. Server actions are reachable by direct POST,
not only through the UI, so guarding the screens alone would not be enough.

## 0008 — The prototype runs on in-memory mock data behind a service layer

**Date:** 2026-07-25 · **Status:** Accepted

Screens read and write through service modules in `apps/admin/services/`
(`listCustomers()`, `createOrder()`, `recordDelivery()`, …). Those services are
backed by an in-memory store seeded with fabricated bakery data. Nothing touches
Supabase yet.

The schema is blocked on four business questions (ORD-3, PAY-3, PAY-6, PRD-4),
and those questions change table shapes, not just column values. Building the UI
against a schema we would then have to rewrite is wasted work; building it
against a service layer is not, because the seam survives.

When the questions are answered, the service function bodies get reimplemented
against Supabase and the screens do not change. `apps/admin/services/store.ts` is
deleted at that point.

**Tradeoff:** the prototype's data resets whenever the dev server restarts, and
nothing exercises row-level security yet. Both are fine for something whose only
job is to show the owner the shape of the app and provoke corrections.

## 0007 — Decision-log entries go through pull requests, never straight to `main`

**Date:** 2026-07-25 · **Status:** Accepted

An entry rides along in the pull request containing the work it describes. A
decision with no code attached — a business rule the owner answers by phone, an
approach settled before it is built — gets its own small docs-only pull request
instead of waiting on unrelated work. Nothing reaches `main` unreviewed.

The point of this file is not a record of decisions, it is **agreement** on them.
A log a teammate can read whenever is a log they read never; a pull request sits
in their review queue until they act on it. The entries here are precisely the
ones worth disagreeing about, and disagreement is cheap before code rests on
them and expensive afterwards.

**Tradeoff:** every decision waits on a review. If pull requests start sitting
for days, this becomes a bottleneck and the alternative is docs-only commits
straight to `main` plus a habit of telling each other what changed. Revisit if
that happens rather than pre-emptively.

**Note:** `main` is not mechanically protected. Branch protection on a private
repository requires a paid GitHub plan, so for now this rule is convention, held
by both teammates rather than enforced by the platform.

## 0006 — Build the admin app before the buyer app

**Date:** 2026-07-25 · **Status:** Proposed

The buyer app has nothing to talk to until customers, products, prices, and
monthly agreements exist. Admin also covers 100% of order volume on day one,
since phone and text orders continue regardless of whether anyone installs an
app — the buyer app is a channel improvement layered on top. The owner is the
one currently in pain and the fastest feedback loop. Mobile additionally carries
real setup cost (PowerSync needs a custom dev build and a physical Android
device; OTP costs money per SMS).

Proposed order: schema and RLS → admin (customers, products, orders) → daily
distribution → payments and cheque tracking → costs and reports → buyer app.

**Tradeoff:** customers wait longer for self-service ordering. Acceptable,
because the owner can enter their orders in the meantime exactly as she does now.

## 0005 — One buyer app with role-branched screens, not two apps

**Date:** 2026-07-25 · **Status:** Proposed

Wholesale and retail customers share most of the surface: auth, profile, order
history, balance, payments, receipts. The real differences are roughly three
screens — wholesale confirms a monthly quantity and views a delivery schedule,
retail orders for a date and pays now. Two codebases would double the build and
release burden for that.

When the buyer app is built, ship **wholesale first**: smaller surface, Baatsonaa
Total is an obvious pilot customer, and it validates offline sync and OTP auth
with one cooperative user rather than a crowd.

## 0004 — Money is stored as integer pesewas

**Date:** 2026-07-25 · **Status:** Proposed

All money is in Ghana Cedis, stored and computed as integers in minor units
(1 GHS = 100 pesewas). Floating point cannot represent decimal currency exactly
and the errors compound across a month of daily deliveries. Formatting to
`GHS 1,234.56` happens only at the display edge.

Related: an order line snapshots the unit price that applied when the order was
placed, so changing a product price never rewrites the value of a past order.

## 0003 — `packages/shared` ships raw TypeScript, with no build step

**Date:** 2026-07-25 · **Status:** Proposed

`main` points at `src/index.ts`. Metro compiles TypeScript natively, and Next.js
picks it up with `transpilePackages: ['@bread/shared']`. A build step would mean
a watch-and-rebuild loop during development and a stale-`dist` failure mode.

The constraint this creates: `shared` must stay environment-neutral. Types, Zod
schemas, constants, and pure functions only — no React, no React Native, no
`next/*`, no Node built-ins, no I/O.

## 0002 — npm workspaces, and no Turborepo yet

**Date:** 2026-07-25 · **Status:** Proposed

npm hoists into a single root `node_modules`, which is the layout Metro is
happiest with. pnpm is better software, but its symlinked layout is the most
common source of "works on web, breaks in Metro" bugs, and the usual fix
(`node-linker=hoisted`) discards most of its advantage. For a small team that
does not want to debug a bundler, npm is the lower-risk pick. Switching later is
contained.

Turborepo is deferred: with three workspaces, `npm run dev -w apps/admin` is
enough, and Turbo is another config file and mental model. It earns its place
when we want cached `turbo run typecheck lint` across everything, or when Vercel
builds get slow. Adding it later is a small `turbo.json`.

**Known constraints this creates:**

- React must be pinned to one version at the root via `overrides`, or hoisting
  produces two copies and "invalid hook call" errors.
- `apps/mobile/metro.config.js` must set `watchFolders` to the repo root and add
  both the app's and the root's `node_modules` to `nodeModulesPaths`.
- Vercel's root directory must be set to `apps/admin`.

## 0001 — Monorepo containing both apps and the database

**Date:** 2026-07-25 · **Status:** Proposed

`apps/admin`, `apps/mobile`, `packages/shared`, and `supabase/` live in one
repository. The two apps share types, validation, and business rules, and a
schema change usually needs a matching change in both — a single repo keeps that
in one reviewable pull request.

**Tradeoff:** Expo and Next.js in one workspace is the known-painful combination,
which is why 0002 and 0003 exist to contain it.
