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

- **Who carries the offline delivery checklist?** Offline-first is required for
  distribution on the road, but the mobile app is described as the buyer app.
  Is the driver a role inside the buyer app, a separate surface, or does the
  owner travel with the laptop? Determines the whole sync architecture.
- **How does a monthly wholesale commitment become daily deliveries?** Equal
  split across the month, or a per-day quantity stated by the customer? What
  happens to a month-end shortfall — carried, forgiven, or re-billed?
- **Cheque lifecycle.** Is a cheque "paid" on receipt or on clearing? Do we need
  received → deposited → cleared → bounced? A customer's balance means something
  different at each step.
- **Credit terms.** Do wholesale customers pay up front or in arrears? Are
  partial payments allowed? Can a balance go negative, and up to what limit?
- **Pricing.** One price list, or a negotiated price per wholesale customer?
- **Unsold or refused bread.** Does a short or refused drop reduce what is owed?
  Do we track waste as a cost?
- **Cost granularity.** Gas, ingredients, and transport as daily lump sums, or
  allocated per batch for profit-per-loaf? Does profit include wages?
- **Phone OTP budget.** Supabase phone auth needs an SMS provider billed per
  message in Ghana. Is there a budget, or should admin use email + password?
- **Owner-entered orders.** Confirming the assumption that admin can create an
  order for a customer who phones in and never installs the app.
- **Tax.** Do receipts and invoices need Ghana VAT and levies, or is this
  informal for v1?

Working defaults unless told otherwise: English only, dates `DD/MM/YYYY`,
Africa/Accra is UTC+0 with no daylight saving, business day is midnight to
midnight local.

---

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

When the buyer app is built, ship **wholesale first**: smaller surface, Barcelona
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
