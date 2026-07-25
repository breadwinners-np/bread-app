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

## Cloning the repository

The repository is private and owned by the `breadwinners-np` organization, so
accept your invite first — check your email or visit
https://github.com/orgs/breadwinners-np/invitation.

Install git and the GitHub CLI, then authenticate. On macOS:

```bash
brew install git gh
gh auth login
```

At the `gh auth login` prompts choose **GitHub.com**, then **HTTPS**, then
**Login with a web browser**.

On Windows use [git-scm.com](https://git-scm.com) and
[cli.github.com](https://cli.github.com); on Linux use your package manager. SSH
keys or a personal access token work just as well if you already have them.

Then clone:

```bash
git clone https://github.com/breadwinners-np/bread-app.git
cd bread-app
git config user.name "Your Name"
git config user.email "your@email.com"
```

Confirm you have the documents — `ls` should show `CLAUDE.md`, `DECISIONS.md`,
`HANDOFF.md`, and this README. If they are missing, they are still on an
unmerged branch:

```bash
git checkout chore/project-setup-docs
```

New to the project? Read [HANDOFF.md](HANDOFF.md) first — it is the full context
dump. Then [CLAUDE.md](CLAUDE.md) for the working rules.

## Running the admin app

You need Node.js 22+ and npm 10+. Nothing else — the prototype has no database.

```bash
npm install
npm run dev
```

Then open **http://localhost:3000**.

Paste those two lines exactly, with nothing after them. zsh does not treat `#` as
a comment in interactive shells by default, so a trailing comment becomes an
argument and `next dev` fails with "Invalid project directory".

**This is a prototype running on in-memory mock data.** There is no database and
no login. Data resets when the dev server restarts, and everything in it is
fabricated. Do not enter real customer information. See
[DECISIONS.md](DECISIONS.md) entries 0008 and 0009.

What works today: the daily delivery round, customers with balances, order
history, and forms to add a customer or an order. Payments, Costs, and Reports
are placeholders that name the business questions blocking them.

Other useful commands — `build` makes a production build, `typecheck` and `lint`
run across every workspace:

```bash
npm run build
npm run typecheck
npm run lint
```

## Not built yet

The mobile app and the database do not exist. Once the schema questions in
[DECISIONS.md](DECISIONS.md) are answered, this is roughly what setup will
become — Docker and the [Supabase CLI](https://supabase.com/docs/guides/cli) for
the database, Android Studio or a device for the mobile app:

```bash
cp .env.example .env
supabase start
supabase db reset
npm run dev -w apps/mobile
```

Copy `.env.example` and fill in your own values, `supabase start` brings up local
Postgres and Studio, `db reset` applies migrations and seed data, and the last
line starts the Expo dev server.

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
supabase db reset
supabase db push
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
