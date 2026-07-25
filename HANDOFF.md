# Handoff — full project context

**For:** the second teammate and their Claude Code session
**Written:** 2026-07-25
**Status of the project:** planning complete, nothing built yet

Read this file first, then [CLAUDE.md](CLAUDE.md) for the rules and
[DECISIONS.md](DECISIONS.md) for the reasoning behind each choice. This file
tells you where things stand and what happens next; the other two tell you how
to work and why things are the way they are.

**If you have not cloned the repository yet, start with section 8 at the end.**

If you are Claude and you were handed this file: **no application code exists
yet.** Do not assume any scaffolding, schema, or dependency is in place. Verify
before you build, and see "What not to do next" at the end.

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
- **Buyer mobile app** — used by customers on Android phones. Ordering, paying,
  and confirming monthly wholesale quantities.

### The business

- **Wholesale customers**, led by one called Barcelona Total, agree a quantity
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
for admin. Expo + React Native, Android first, for mobile. Supabase for
Postgres, phone OTP auth, storage for cheque and receipt photos, realtime, and
row-level security. On-device SQLite synced with Supabase for offline, PowerSync
preferred. Cash and cheque recorded manually in v1; Paystack mobile money later.
Recharts for reports, with Excel and PDF export.

**Offline is a hard requirement**, because daily distribution happens on the road
where the connection drops.

---

## 2. Where the project actually stands

Be precise about this, because it is easy to assume more exists than does.

**What exists:** four documentation files. That is all.

```
.gitignore      tailored for Next.js + Expo + Supabase, with a secrets block
README.md       project overview and getting started
CLAUDE.md       stack, commands, architecture rules, and a "do not" list
DECISIONS.md    numbered decision log + open business questions
HANDOFF.md      this file
```

**What does not exist yet:**

- no `package.json`, no workspaces, no `node_modules`, no dependencies installed
- no `apps/admin`, no `apps/mobile`, no `packages/shared`
- no `supabase/` directory, no migrations, no RLS policies, no Supabase project
- no schema design, no tables, no types
- no CI, no deployment, no Vercel or EAS setup

The commands listed in CLAUDE.md and README.md describe the **intended** setup.
Most of them will not run yet. That is expected.

### Repository and access

- Repo: `github.com/breadwinners-np/bread-app`, private, owned by the
  `breadwinners-np` organization. Both teammates are **organization owners**,
  so both have complete and equal access.
- `main` is at the initial commit and contains only `.gitignore` and
  `README.md`.
- All the documentation lives on the branch **`chore/project-setup-docs`**,
  which is pushed but **not yet merged**. If you cannot see `DECISIONS.md` on
  the repo landing page, that is why — switch branches or merge the PR.
- The GitHub CLI (`gh`) is not installed on the first teammate's machine, so
  pull requests and issues are being created through the web UI.
- There is a stray empty file named `app` at the repo root, left over from an
  editor slip. It is untracked and can be deleted.

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

**Everything except 0007 is still Proposed.** They are recommendations, not
settled team choices. Merging the open pull request is what converts them into
agreements. If the second teammate disagrees with any of them, now is the
cheapest possible moment to say so — no code rests on them yet.

### Key technical constraints these create

- React must be pinned to one version at the workspace root via `overrides`, or
  npm hoisting produces two copies and "invalid hook call" errors.
- `apps/mobile/metro.config.js` must set `watchFolders` to the repo root and add
  both the app's and the root's `node_modules` to `nodeModulesPaths`.
- `packages/shared` must stay environment-neutral — no React, no React Native,
  no `next/*`, no Node built-ins, no I/O. Types, Zod schemas, constants, and
  pure functions only.
- Vercel's root directory must be set to `apps/admin`.
- PowerSync needs a custom dev build and a physical Android device; Expo Go will
  not work. It is also a paid service beyond a free tier. Alternatives if that
  is unattractive: Expo SQLite with a hand-rolled sync queue, or WatermelonDB.

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

Planned sequence:

1. **Merge the open pull request** — converts decisions 0001–0006 from proposals
   into team agreements.
2. **Get the four business-rule answers** from the owner.
3. **Design the schema and RLS policies.** This is the next real build step and
   the most expensive thing to get wrong, which is why it waits on step 2.
4. **Scaffold the monorepo** — workspaces, `packages/shared`, `apps/admin`.
5. **Admin app**: customers, products, orders → daily distribution → payments
   and cheque tracking → costs and reports.
6. **Buyer app**, wholesale flows first, then retail.

Steps 1 and 2 can happen in parallel.

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

- **Do not scaffold the apps yet.** Decisions 0001–0006 are unapproved and the
  schema is unanswered. Scaffolding now means rewriting later.
- **Do not design the schema before the four questions in section 4 are
  answered.** Ask; do not invent an answer to unblock yourself.
- **Do not assume the commands in CLAUDE.md work.** Most describe the intended
  setup, not the current one.
- **Do not push to `main`,** even though nothing mechanically stops you.
- **Do not duplicate work.** Two teammates with two Claude sessions on one repo
  can easily build the same thing twice. Confirm who owns what first.
- **Do not treat this file as current forever.** It is a snapshot from
  2026-07-25. DECISIONS.md is the living record; if the two disagree, DECISIONS.md
  wins.

---

## 8. Cloning and first-time setup

The one thing that catches people out: **`main` is nearly empty.** Every document
lives on the `chore/project-setup-docs` branch until that branch is merged. If
you clone and see only a README, that is why — see step 4.

### 1. Accept the organization invite

Check your email, or go to https://github.com/orgs/breadwinners-np/invitation.
You cannot clone a private repository until you are a member.

### 2. Install prerequisites

macOS:

```bash
brew install git gh
```

On Windows use [git-scm.com](https://git-scm.com) and
[cli.github.com](https://cli.github.com); on Linux use your package manager.

### 3. Authenticate with GitHub

```bash
gh auth login
```

Choose **GitHub.com** → **HTTPS** → **Login with a web browser**, then paste the
one-time code. This is the least painful route for a private repository — it
stores credentials so plain `git` commands work afterwards. SSH keys or a
personal access token work equally well if you already have them.

### 4. Clone and switch to the branch

```bash
cd ~/Desktop
git clone https://github.com/breadwinners-np/bread-app.git
cd bread-app
git checkout chore/project-setup-docs
```

The checkout matters. `main` holds only `.gitignore` and `README.md`.

### 5. Verify

```bash
ls -la
git status -sb
```

You should see `CLAUDE.md`, `DECISIONS.md`, `HANDOFF.md`, `README.md`, and
`.gitignore`, and the branch line should read
`## chore/project-setup-docs...origin/chore/project-setup-docs`. If `HANDOFF.md`
is missing, the checkout in step 4 did not take.

### 6. Set your commit identity

```bash
git config user.name "Your Name"
git config user.email "your@email.com"
```

### 7. Read the documents

`HANDOFF.md` first, then `CLAUDE.md` for the working rules, then `DECISIONS.md`
for the reasoning.

**Do not run `npm install`** — there is no `package.json` yet. Nothing is
scaffolded.

### 8. If you are using Claude Code

```bash
npm install -g @anthropic-ai/claude-code
cd ~/Desktop/bread-app
claude
```

Then tell it: *"Read HANDOFF.md and CLAUDE.md before doing anything."* Claude
Code picks up `CLAUDE.md` automatically but not this handoff.

### 9. Confirm your access level

Check https://github.com/orgs/breadwinners-np/people and confirm you are listed
as **Owner**, not Member. Member grants clone and push but not settings or
access management, which is not the parity this setup intends.
