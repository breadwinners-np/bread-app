# Handoff — full project context

**For:** the second teammate and their Claude Code session
**Written:** 2026-07-25 · **Last updated:** 2026-07-25
**Status of the project:** admin prototype running on mock data; no database yet

Read this file first, then [CLAUDE.md](CLAUDE.md) for the rules and
[DECISIONS.md](DECISIONS.md) for the reasoning behind each choice. This file
tells you where things stand and what happens next; the other two tell you how
to work and why things are the way they are.

If you are Claude and you were handed this file: an admin **prototype** exists,
running entirely on in-memory mock data. There is **no database, no schema, and
no authentication**. Verify what is actually present before you build, and see
"What not to do next" at the end.

---

## 1. What we are building

We are digitizing the operations of a fresh bread company in Accra, Ghana. The
business currently runs on an Excel sheet, physical cheques, paper receipts, and
orders placed by phone or text message. We are replacing that with one connected
system.

**Two apps, one Supabase database.** They never call each other; they share the
database, and a customer order placed on a phone reaches the owner's screen
through Supabase realtime.

- **Admin web app** — used only by the owner, on a laptop. Orders, daily
  distribution, costs, payments, reports.
- **Buyer mobile app** — used by customers on Android phones and iPhones.
  Ordering, paying, and confirming monthly wholesale quantities.

### The business

- **Wholesale customers**, led by one called Baatsonaa Total, agree a quantity
  for the whole month by phone or text and pay by cheque.
- **Retail customers** buy smaller amounts and pay in cash, mobile money, or
  cheque.
- Bread is baked and delivered **daily** so it stays fresh, even under a monthly
  agreement. A monthly commitment is a promise, not a single delivery.
- Costs tracked: gas/fuel for the furnaces, ingredients (flour, yeast, butter,
  sugar, salt), and transport for daily distribution.

### Who uses it

- **Owner/admin** — sees everything, the only administrator. Around fifty, not
  very technical, works from a laptop, wants a very simple interface. Large
  buttons, plain language, few choices per screen.
- **Business customer** — confirms monthly quantity, sees own deliveries and
  balance. Must never see costs, profit, or another customer.
- **Individual customer** — orders, pays, sees own history. Same restrictions.
- **Distribution staff** — optional, later. A simple daily delivery checklist.

### Stack

TypeScript everywhere plus SQL. Next.js App Router + React + Tailwind on Vercel
for admin. Expo + React Native targeting both Android and iOS, Android released
first, for mobile. Supabase for
Postgres, phone OTP auth, storage for cheque and receipt photos, realtime, and
row-level security. On-device SQLite synced with Supabase for offline, PowerSync
preferred. Cash and cheque recorded manually in v1; Paystack mobile money later.
Recharts for reports, with Excel and PDF export.

**Offline is a hard requirement**, because daily distribution happens on the road
where the connection drops.

---

## 2. Where the project actually stands

Be precise about this, because it is easy to assume more exists than does.

**What exists:** the documentation, plus a working admin prototype.

```
apps/admin/            Next.js 16 admin app — runs, builds, typechecks clean
  app/                 screens (Today, Deliveries, Orders, Customers, + stubs)
  components/          sidebar and shared UI
  services/            data layer — MOCK, in-memory (decision 0008)
packages/shared/       @bread/shared — types, zod schemas, money/date helpers,
                       pure order and balance logic
CLAUDE.md              architecture rules and a "do not" list
DECISIONS.md           numbered decision log + open business questions
HANDOFF.md             this file
```

Run it with `npm install && npm run dev` from the repo root, then open
http://localhost:3000.

**What works:** the daily delivery round (mark delivered in full, part
delivered with a quantity, or could not deliver — the dashboard updates),
customer list with balances, customer detail with order and payment history,
orders and deliveries as a month calendar you tap into, forms to add a customer
and an order, inventory purchases, payments recorded against a customer's
deliveries, and reports over a chosen stretch of days. Recording a cost with no
countable item is still a placeholder naming the open questions blocking it.

**Changed 2026-07-29** (decisions 0016–0017, asked for by the owner's daughter):
orders and deliveries are read as a month calendar, and reports say "profit"
rather than "left over".

**Money rules added 2026-07-28** (decisions 0012–0014): an order is owed once it
has been delivered, a part delivery is owed for what arrived, and a payment a
customer reports from their phone counts for nothing until the owner confirms
it. The buyer app's payment claim has a schema and a service function but
nothing calls them yet.

**What does not exist yet:**

- **no database.** All data is in `apps/admin/services/store.ts`, in memory, and
  resets when the dev server restarts. No Supabase project, no migrations, no
  RLS policies, no schema.
- **no authentication.** Every screen and server action is open (decision 0009).
- no `apps/mobile`, no offline sync, no PowerSync.
- no monthly wholesale commitments — blocked on ORD-3.
- no CI, no deployment, no Vercel or EAS setup.

The Supabase commands in CLAUDE.md and README.md describe the **intended** setup
and will not run yet.

### Repository and access

- Repo: `github.com/breadwinners-np/bread-app`, private, owned by the
  `breadwinners-np` organization. Both teammates are **organization owners**,
  so both have complete and equal access.
- `main` holds the documentation and the admin prototype. Setup instructions
  are in [README.md](README.md).

---

## 3. Decisions made so far

Full reasoning for each is in [DECISIONS.md](DECISIONS.md). Summarized:

| # | Decision | Status |
| --- | --- | --- |
| 0001 | Monorepo holding both apps, shared package, and the database | Proposed |
| 0002 | npm workspaces; Turborepo deferred until there is a reason | Proposed |
| 0003 | `packages/shared` ships raw TypeScript, no build step | Proposed |
| 0004 | Money stored as integer pesewas; order lines snapshot unit price | Proposed |
| 0005 | One buyer app with role-branched screens, not two apps | Proposed |
| 0006 | Build admin before the buyer app | Proposed |
| 0007 | Decision-log entries go through pull requests, never straight to `main` | **Accepted** |
| 0008 | The prototype runs on in-memory mock data behind a service layer | **Accepted** |
| 0009 | The admin prototype has no authentication | **Accepted** |

**0001–0006 are still Proposed.** They are recommendations, not settled team
choices, and the second teammate has not reviewed them. The prototype was built
on top of them, so disagreeing now costs a little rework — but far less than
disagreeing after the database exists. Say so if you disagree.

### Key technical constraints these create

- React must be pinned to one version at the workspace root via `overrides`, or
  npm hoisting produces two copies and "invalid hook call" errors.
- `apps/mobile/metro.config.js` must set `watchFolders` to the repo root and add
  both the app's and the root's `node_modules` to `nodeModulesPaths`.
- `packages/shared` must stay environment-neutral — no React, no React Native,
  no `next/*`, no Node built-ins, no I/O. Types, Zod schemas, constants, and
  pure functions only.
- Vercel's root directory must be set to `apps/admin`.
- PowerSync needs a custom dev build and a physical device on each platform;
  Expo Go will not work. It is also a paid service beyond a free tier.
  Alternatives if that is unattractive: Expo SQLite with a hand-rolled sync
  queue, or WatermelonDB.
- iOS adds a Mac with Xcode, an Apple Developer Program membership at $99/year,
  and App Store review to every release. Android needs neither. See 0018.

---

## 4. Open questions — these block schema work

These are real business rules that only the bakery owner can answer. **Do not
guess at them.** A wrong guess in financial logic is far more expensive than a
question. The full list is at the top of [DECISIONS.md](DECISIONS.md); these
four block the schema directly:

1. **How does a monthly wholesale commitment become daily deliveries?** Equal
   split across the month, or a per-day quantity the customer states? What
   happens to a month-end shortfall — carried, forgiven, or re-billed?
2. **Is a cheque "paid" on receipt or on clearing?** Cheques bounce. If we need
   received → deposited → cleared → bounced, a customer's balance means
   something different at each stage.
3. **Can a balance go negative, and up to what limit?** Do wholesale customers
   pay up front or in arrears? Are partial payments allowed?
4. **Is wholesale pricing one price list, or negotiated per customer?**

Six more are listed in DECISIONS.md, including who carries the offline delivery
checklist (which determines the entire sync architecture), cost granularity,
whether phone OTP has an SMS budget, and whether receipts need Ghana VAT.

Working defaults unless told otherwise: English only, dates `DD/MM/YYYY`,
Africa/Accra is UTC+0 with no daylight saving, business day is midnight to
midnight local.

---

## 5. What happens next

Done: the docs are merged to `main`, and the admin prototype is built.

1. **Show the prototype to the bakery owner** and get the four business-rule
   answers. The prototype exists partly to provoke those answers — it is far
   easier to react to a screen than to a question in the abstract.
2. **Design the schema and RLS policies.** Still the most expensive thing to get
   wrong, and still blocked on step 1.
3. **Replace the mock services with Supabase.** The service layer in
   `apps/admin/services/` is the seam; screens should not change.
4. **Add authentication** before any real customer data is entered (0009).
5. **Finish the admin app**: payments and cheque tracking → costs → reports.
6. **Buyer app**, wholesale flows first, then retail.

### Splitting the work

Two people on a fresh monorepo will collide on `packages/shared` and the schema
within a day. The cleanest split is one person on Supabase (schema, migrations,
RLS policies) and the other on the admin UI, with the shared types agreed
between you before either starts. Agree on this before writing code.

---

## 6. How we work

Full rules are in [CLAUDE.md](CLAUDE.md). The ones that matter most:

- **Plan before building.** Propose the approach and get agreement before
  writing many files.
- **Nobody pushes to `main`.** Named branches, merged through pull requests.
  Note that `main` is not mechanically protected — branch protection on a
  private repo requires a paid GitHub plan — so this is convention held by both
  teammates, not enforced by the platform.
- **Every decision goes in DECISIONS.md**, in the same pull request as the work
  it explains. A decision with no code attached gets its own small docs-only
  pull request. Mark entries `Proposed` until the other teammate agrees.
- **Row-level security is not optional.** Every table holding customer data gets
  explicit policies in the same pull request as the migration. Customers read
  only their own rows; costs, profit, and margins are admin-only.
- **Never commit secrets.** `.env`, `.env.*`, `*.key`, `*.pem` are gitignored.
  The Supabase service role key bypasses RLS and belongs only in Edge Functions
  and server-side admin code — never in the mobile app, never in a client
  component, never behind a `NEXT_PUBLIC_` or `EXPO_PUBLIC_` prefix.
- **Keep API routes and components thin.** Business logic lives in
  `packages/shared` or in a service module.
- **Flag dependencies before adding them.**
- **Ask instead of guessing** on business rules.

---

## 7. What not to do next

Written for whichever Claude session picks this up:

- **Do not design the schema before the four questions in section 4 are
  answered.** Ask; do not invent an answer to unblock yourself.
- **Do not put real customer data into the prototype.** There is no
  authentication and no row-level security. It holds fabricated data only.
- **Do not build on `services/store.ts`.** It is scaffolding to be deleted, not
  a foundation. Screens must go through the service modules, never the store.
- **Do not assume the Supabase commands in CLAUDE.md work.** They describe the
  intended setup, not the current one.
- **Do not push to `main`,** even though nothing mechanically stops you.
- **Do not duplicate work.** Two teammates with two Claude sessions on one repo
  can easily build the same thing twice. Confirm who owns what first.
- **Do not treat this file as current forever.** It is a snapshot from
  2026-07-25. DECISIONS.md is the living record; if the two disagree, DECISIONS.md
  wins.
