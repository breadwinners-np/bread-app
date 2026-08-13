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
| `apps/storefront` | Anyone, for the demo | Web | Place and pay for an order online. A prototype shown to the owner, not the real buyer app |
| `apps/mobile` | Wholesale and retail customers | Android phones and iPhones | Place orders, pay, confirm monthly quantities. **Not built yet** |

The apps never talk to each other. They share one Supabase database, and orders
placed on a phone reach the owner's screen in near real time through Supabase
realtime.

## Stack

- TypeScript everywhere, plus SQL
- **Admin** — Next.js (App Router), React, Tailwind CSS, deployed to Vercel
- **Mobile** — Expo + React Native, Android and iOS, Android released first
- **Backend** — Supabase: Postgres, phone OTP auth, file storage, realtime, and
  row-level security
- **Offline** — on-device SQLite synced with Supabase, so daily distribution
  works where the signal drops
- **Reports** — Recharts, with export to Excel and PDF

## Repository layout

```
apps/
  admin/            Next.js admin web app
  storefront/       Next.js customer ordering demo
  mobile/           Expo React Native buyer app (not built yet)
packages/
  shared/           @bread/shared — types, zod schemas, constants, pure logic
supabase/
  migrations/       SQL schema and changes
scripts/
  verify/           checks that only make sense against a real database
CLAUDE.md           architecture rules and conventions — read this first
TESTING.md          what is checked, what it found, what is still untested
```

This is an npm workspaces monorepo. `packages/shared` holds anything both apps
need and ships raw TypeScript, so there is no build step to run before using it.

## Cloning the repository

The repository is private and owned by the `breadwinners-np` organization, so
you need to be a member before you can clone it. Ask an organization owner for
an invite if you have not had one.

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

New to the project? Read [HANDOFF.md](HANDOFF.md) first — it is the full context
dump. Then [CLAUDE.md](CLAUDE.md) for the working rules.

## Running the apps

You need Node.js 22+ and npm 10+, and a Supabase project. **Both apps read and
write one shared Supabase database, so they will not start without credentials.**
That is deliberate: without them the admin app would otherwise render a
working-looking bakery with no orders and no money in it.

First time, once:

1. Create a Supabase project (free tier is fine).
2. Run every file in `supabase/migrations/` in the SQL editor, in order.
3. Copy the environment files and fill in the three values from
   **Project settings → Data API** and **→ API Keys**:

```bash
cp apps/storefront/.env.example apps/storefront/.env.local
cp apps/admin/.env.example apps/admin/.env.local
```

Both files point at the **same** project — copy the values across rather than
creating a second one. Full walkthrough in
[apps/storefront/README.md](apps/storefront/README.md).

Then:

```bash
npm install
npm run dev
npm run dev:storefront
```

The admin app is on **http://localhost:3000** and the storefront on
**http://localhost:3001**. Run them in two terminals to see an order placed on
one appear on the other.

Paste those lines exactly, with nothing after them. zsh does not treat `#` as a
comment in interactive shells by default, so a trailing comment becomes an
argument and `next dev` fails with "Invalid project directory".

**This is still a prototype.** The admin app has no login at all; the
storefront's customer accounts are a phone number and a PIN rather than the
planned SMS confirmation (decision 0027). The storefront's
payment step is mocked rather than real (see
[apps/storefront/README.md](apps/storefront/README.md)), and the seeded data is
fabricated. Do not enter real customer information.

What works today: the daily delivery round, customers with balances, order
history, recording payments against a customer's deliveries, inventory
purchases, and reports over any stretch of days with charts and a plain-language
summary. Recording costs that have no countable item is still a placeholder that
names the questions blocking it.

Other useful commands — `build` makes a production build, `typecheck` and `lint`
run across every workspace:

```bash
npm run build
npm run typecheck
npm run lint
```

## Testing

```bash
npm test
npm run verify:security
npm run verify:integrity
```

`npm test` covers the business logic — money, dates, balances — with no database.
The `verify:` scripts run against the real Supabase project, because what they
check (row-level security, function permissions, constraints, transactions) only
exists in the database. They found a live vulnerability, since fixed; see
[TESTING.md](TESTING.md) for what is checked, what it found, and what is still
untested.

## Not built yet

The mobile app does not exist. Once the schema questions in
[DECISIONS.md](DECISIONS.md) are answered, this is roughly what its setup will
become — Android Studio or a device, plus Xcode on a Mac once iOS builds start:

```bash
npm run dev -w apps/mobile
```

The [Supabase CLI](https://supabase.com/docs/guides/cli) is also not set up yet.
Migrations are currently applied by pasting them into the SQL editor, which is
fine for two people and one project but will not stay fine — see
[TESTING.md](TESTING.md).

## Environment variables

Each app has its own `.env.example`. Copy it to `.env.local` in the same
directory and fill in your own values. **Never commit a real key.** Each
teammate keeps their own local copy, and `.env`, `.env.*` (except
`.env.example`), `*.key`, and `*.pem` are all gitignored.

Variables prefixed `NEXT_PUBLIC_` or `EXPO_PUBLIC_` are shipped to the client and
are not secret. Everything else is. The Supabase **service role key bypasses
row-level security** — it belongs only in Edge Functions and server-side admin
code, and must never appear in the mobile app or in any client component.

## Database

The schema lives in `supabase/migrations`, applied in order by pasting each file
into the Supabase SQL editor. Never change the schema by clicking around in the
dashboard, and never edit a migration that has already been applied — correct it
with a new one. Once the Supabase CLI is set up this becomes `supabase db push`
and `supabase gen types typescript`.

Every table holding customer data has row-level security enabled. There is no
customer login yet, so there is no "their own rows" to scope a policy by: only
`products` is readable by the public key, and everything else is reachable only
from server-side code holding the secret key.

**RLS is not the whole story.** Postgres grants `EXECUTE` on a function to
`PUBLIC` by default and PostgREST publishes it, and a `security definer`
function exists precisely to bypass RLS — so a migration that adds a function
must revoke execute explicitly, exactly as a new table must state who can read
it. This was a live hole, not a hypothetical one: see decision 0024 in
[DECISIONS.md](DECISIONS.md) and `npm run verify:security`, which guards against
its return.

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
