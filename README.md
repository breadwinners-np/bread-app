# bread-app

Operations software for a fresh bread company in Accra, Ghana.

The business currently runs on an Excel sheet, physical cheques, paper receipts,
and orders placed by phone or text message. This repository replaces that with
one connected system: an admin web app for the owner, a mobile app for customers,
and a single shared database.

## The two apps

| App | Who uses it | Where | What it does |
| --- | --- | --- | --- |
| `apps/admin` | The owner (sole administrator) | Laptop, web | Orders, daily distribution, costs, payments, reports |
| `apps/mobile` | Wholesale and retail customers | Android phones | Place orders, pay, confirm monthly quantities |

The apps never talk to each other. They share one Supabase database, and orders
placed on a phone reach the owner's screen in near real time through Supabase
realtime.

## Stack

- TypeScript everywhere, plus SQL
- **Admin** — Next.js (App Router), React, Tailwind CSS, deployed to Vercel
- **Mobile** — Expo + React Native, Android first
- **Backend** — Supabase: Postgres, phone OTP auth, file storage, realtime, and
  row-level security
- **Offline** — on-device SQLite synced with Supabase, so daily distribution
  works where the signal drops
- **Reports** — Recharts, with export to Excel and PDF

## Repository layout

```
apps/
  admin/            Next.js admin web app
  mobile/           Expo React Native buyer app
packages/
  shared/           @bread/shared — types, zod schemas, constants, pure logic
supabase/
  migrations/       SQL schema and changes
  functions/        Edge Functions (payment webhook, schedules, SMS)
  policies/         row-level security policies
CLAUDE.md           architecture rules and conventions — read this first
```

This is an npm workspaces monorepo. `packages/shared` holds anything both apps
need and ships raw TypeScript, so there is no build step to run before using it.

## Getting started

You need Node.js 22+, npm 10+, Docker (for local Supabase), and the
[Supabase CLI](https://supabase.com/docs/guides/cli). For the mobile app you also
need Android Studio or a physical Android device.

```bash
git clone <repo-url>
cd bread-app
npm install

cp .env.example .env          # then fill in your own values — see below
supabase start                # local Postgres, Studio, and auth
supabase db reset             # apply migrations and seed data
```

Run an app:

```bash
npm run dev -w apps/admin     # http://localhost:3000
npm run dev -w apps/mobile    # Expo dev server
```

## Environment variables

Copy `.env.example` to `.env` and fill in your own values. **Never commit `.env`.**
Each teammate keeps their own local copy, and `.env`, `.env.*`, `*.key`, and
`*.pem` are all gitignored.

Variables prefixed `NEXT_PUBLIC_` or `EXPO_PUBLIC_` are shipped to the client and
are not secret. Everything else is. The Supabase **service role key bypasses
row-level security** — it belongs only in Edge Functions and server-side admin
code, and must never appear in the mobile app or in any client component.

## Database

The schema lives in `supabase/migrations` and is applied with the Supabase CLI.
Never change the schema by clicking in the Supabase dashboard, and never edit a
migration that has already been merged — correct it with a new one.

```bash
supabase migration new add_monthly_commitments
supabase db reset             # rebuild locally from scratch
supabase db push              # apply to the linked remote project
supabase gen types typescript --local > packages/shared/src/database.types.ts
```

Every table that holds customer data has row-level security enabled with explicit
policies. Customers can read only their own rows; costs, profit, and margins are
admin-only. A table without policies is an incomplete migration.

## Conventions

- All money is in **Ghana Cedis**, stored as integer pesewas. No floating point.
- Dates display as **DD/MM/YYYY**. Accra is UTC+0 with no daylight saving.
- The admin UI is deliberately simple and large-buttoned — the primary user is
  not technical.

## Contributing

Nobody pushes to `main`. Work on a named branch (`feat/`, `fix/`, `chore/`) and
merge through a pull request. Keep pull requests small enough to review, and
include migrations together with their RLS policies in the same PR.

Read [CLAUDE.md](CLAUDE.md) before your first change. It covers the architecture
rules, where business logic belongs, and the things not to do.
