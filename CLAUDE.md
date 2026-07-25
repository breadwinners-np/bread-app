# CLAUDE.md

Guidance for Claude Code and for humans working in this repository.

## What this project is

We are digitizing the operations of a fresh bread company in Accra, Ghana. The
business currently runs on an Excel sheet, physical cheques, paper receipts, and
orders placed by phone or text message. We are replacing that with one connected
system.

Two client apps, one Supabase database:

- **Admin web app** (`apps/admin`) — used only by the owner, on a laptop. Orders,
  daily distribution, costs, payments, reports.
- **Buyer mobile app** (`apps/mobile`) — used by customers on Android phones.
  Placing orders, paying, and confirming monthly wholesale quantities.

The two apps never call each other. They share the database. A customer order
placed on a phone reaches the owner's screen through Supabase realtime.

### The business, in short

- **Business/wholesale customers** (led by Barcelona Total) agree a quantity for
  the whole month by phone or text and pay by cheque.
- **Individual/retail customers** buy smaller amounts and pay in cash, mobile
  money, or cheque.
- Bread is baked and delivered **daily** so it stays fresh, even under a monthly
  wholesale agreement. A monthly agreement is a commitment, not a single delivery.
- Costs to track: gas/fuel for the furnaces, ingredients (flour, yeast, butter,
  sugar, salt), and transport for daily distribution.

### Who uses it

- **Owner/admin** — sees everything. The only administrator. Around fifty, not
  very technical, works from a laptop, wants a very simple interface.
- **Business customer** — confirms monthly quantity, sees own deliveries and
  balance. Must never see costs, profit, or any other customer.
- **Individual customer** — orders, pays, sees own history. Same restrictions.
- **Distribution staff** — optional, later. A simple daily delivery checklist.

## Stack

- **TypeScript everywhere**, plus SQL in the database.
- **Admin**: Next.js (App Router), React, Tailwind CSS. Hosted on Vercel.
- **Mobile**: Expo + React Native. Android first, iOS later.
- **Backend**: Supabase — Postgres, phone OTP auth, storage for cheque and
  receipt photos, auto-generated API, realtime, and row-level security.
- **Offline sync**: on-device SQLite kept in sync with Supabase. PowerSync preferred.
- **Payments**: cash and cheque are recorded manually in v1. In-app mobile money
  via Paystack is a later option.
- **Charts and reports**: Recharts, with export to Excel and PDF.

## Repository layout

```
apps/admin/        Next.js admin web app
apps/mobile/       Expo React Native buyer app
packages/shared/   @bread/shared — types, zod schemas, constants, pure logic
supabase/migrations/  SQL schema and changes
supabase/functions/   Edge Functions (payment webhook, schedules, SMS)
supabase/policies/    row-level security policies
```

`packages/shared` ships raw TypeScript (`main` points at `src/index.ts`). Metro
compiles it natively; Next.js picks it up via `transpilePackages`. There is no
build step for `shared`, and there should not be one.

## Commands

Run from the repository root unless stated otherwise.

```bash
npm install                          # install all workspaces
npm run dev -w apps/admin            # Next.js dev server
npm run dev -w apps/mobile           # Expo dev server
npm run typecheck -w packages/shared # typecheck the shared package
npm run lint                         # lint everything

supabase start                       # local Postgres + Studio (Docker)
supabase db reset                    # rebuild local DB from migrations + seed
supabase migration new <name>        # create a timestamped migration
supabase db push                     # apply migrations to the linked project
supabase gen types typescript --local > packages/shared/src/database.types.ts
```

Never hand-edit `database.types.ts`. Regenerate it after every schema change.

## Architecture rules

**Keep the edges thin.** API routes, server actions, and React components handle
transport, auth checks, and rendering. They do not contain business logic.

**Business logic lives in `packages/shared`** when both apps need it (pricing, the
value of an order, whether a monthly commitment has been met, balance arithmetic,
validation) or in a service module inside an app when only that app needs it. A
component should read like a description of the screen, not a description of the
business.

**`packages/shared` must stay environment-neutral.** Types, Zod schemas,
constants, and pure functions only. No React, no React Native, no `next/*`, no
Node built-ins, no Supabase client instantiation, no I/O. If it cannot run in
both a browser and a React Native runtime, it does not belong there.

**Validate at the boundary with Zod, and share the schema.** Every payload that
crosses a network boundary is parsed by a schema from `packages/shared`. The
mobile app and the admin app validate the same shape with the same code.

**Money is integer minor units.** Store and compute in pesewas (1 GHS = 100
pesewas) as integers. Never use floating point for money. Format for display only
at the very edge, as `GHS 1,234.56`.

**Snapshot prices onto order lines.** An order line records the unit price that
applied when the order was placed. Changing a product's price must never alter
the value of a past order.

**Prefer reuse over duplication.** Before writing a helper, look for an existing
one. If you are tempted to add a dependency, say so and explain the tradeoff
before installing it.

## Database and security

**Row-level security is not optional.** Every table holding customer data has
RLS enabled and explicit policies. A new table without policies is an incomplete
migration, not a follow-up task.

**The rule that matters most:** a customer can read only their own rows. Costs,
profit, margins, and other customers' data are admin-only. When adding a table,
state in the migration who can read it and who can write it.

**Schema changes go through `supabase/migrations`.** Never change the schema by
clicking in the Supabase dashboard — it leaves teammates and CI out of sync.
Migrations are append-only once merged; correct a mistake with a new migration.

**The service role key bypasses RLS.** It may appear only in Edge Functions and
server-side admin code, never in `apps/mobile`, never in a client component,
never in anything prefixed `NEXT_PUBLIC_` or `EXPO_PUBLIC_`.

**Secrets live in `.env` only.** `.env` and `.env.*` are gitignored. `.env.example`
lists variable names with no values and is committed. Each teammate keeps their
own local `.env`.

## Offline and sync

Daily distribution happens on the road, where the connection drops. Offline is a
requirement, not an enhancement.

- The device's SQLite database is the source of truth for the UI. Screens read
  from local state and never block on the network.
- Writes queue locally and sync when connectivity returns. A delivery marked
  complete in a dead zone must survive an app restart.
- Assume every sync can be retried. Writes carry a client-generated UUID so a
  replayed request does not create a duplicate delivery or a duplicate payment.
- Conflict rule: the admin's record wins for anything financial. Ask before
  inventing any other resolution strategy.

## Conventions

- All money is in **Ghana Cedis (GHS)**.
- Dates display as **DD/MM/YYYY**. Timestamps are stored as UTC `timestamptz`.
- Accra is UTC+0 with no daylight saving. A "business day" runs midnight to
  midnight local time.
- The UI is simple and large-buttoned. The primary admin user is not technical:
  plain language over jargon, few choices per screen, obvious primary action,
  confirmation before anything destructive.
- Files and directories are `kebab-case`. React components are `PascalCase`.
- Database tables and columns are `snake_case`, tables plural (`orders`,
  `order_lines`, `payments`).

## Git workflow

- **Nobody pushes to `main`.** Work on a named branch and merge through a pull
  request.
- Branch names: `feat/monthly-commitments`, `fix/cheque-balance`, `chore/ci`.
- Keep pull requests small enough that a teammate can actually review them.
- A PR that touches the schema must include the migration and its RLS policies
  in the same PR.

## Decision log

`DECISIONS.md` at the repository root records why things are the way they are,
and carries an **Open questions** section listing business rules we do not know
yet. Read it before designing anything, and treat an open question as a blocker
rather than something to guess past.

Add an entry whenever a decision would otherwise have to be guessed at or
re-litigated later, and put it in the **same pull request as the change it
describes** so the reasoning arrives with the code. Mark entries `Proposed`
until a teammate agrees. Never rewrite an old entry — supersede it.

This is a two-person team. A decision that lives only in someone's terminal is
not a shared decision.

## How to work on this repo

- **Plan before building.** For any feature, propose the approach and get
  approval before writing many files.
- **Ask instead of guessing.** Business rules here are real rules that a real
  business depends on. If you do not know whether a bounced cheque reduces a
  balance, or how a monthly commitment splits across days, ask. A wrong guess in
  financial logic is worse than a question.
- **Report honestly.** If something is untested, say it is untested. If a
  migration was not applied, say so.

## Do not

- Do not commit `.env`, keys, certificates, or any real customer data.
- Do not put a Supabase service role key, or any secret, in `apps/mobile` or in
  client-side code.
- Do not create a table that holds customer data without RLS policies.
- Do not bypass RLS with the service role to make a query "just work". Fix the
  policy.
- Do not change the database schema through the Supabase dashboard.
- Do not edit a migration that has already been merged.
- Do not put business logic in components or API routes.
- Do not import React, React Native, `next/*`, or Node built-ins in
  `packages/shared`.
- Do not use floating point for money.
- Do not let a product price change rewrite the value of past orders.
- Do not add a dependency without flagging it first.
- Do not push directly to `main`.
- Do not expose costs, profit, or margin data to any customer-facing surface.
- Do not assume network availability on any mobile screen used during delivery.
- Do not invent business rules to unblock yourself.
