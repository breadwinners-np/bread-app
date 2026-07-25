# Why you only see two files — and how to fix it

**For:** the second teammate
**Written:** 2026-07-25

You cloned the repository and found only `.gitignore` and `README.md`. The other
documents — `CLAUDE.md`, `DECISIONS.md`, `HANDOFF.md` — are missing.

**This is not a permissions problem.** Your access is already complete. Nothing
about your account, your invite, or your clone went wrong.

---

## What is actually happening

The project follows a rule: nobody pushes directly to `main`. All work happens on
a named branch and is merged through a pull request. That rule is recorded as
decision 0007 in `DECISIONS.md`.

The setup documents were written under that rule, so they live on a branch called
**`chore/project-setup-docs`** which has not been merged yet. `main` is still at
the very first commit and genuinely contains only two files.

`git clone` gives you `main` by default. So you got the two files that are on
`main`. Anyone cloning right now — including the first teammate — would see
exactly the same thing.

Five commits are sitting on that branch waiting to be merged.

---

## Fix 1 — see the files right now

```bash
cd bread-app
git fetch origin
git checkout chore/project-setup-docs
ls
```

You should now see `CLAUDE.md`, `DECISIONS.md`, `HANDOFF.md`, `README.md`, and
`.gitignore`.

If `git checkout` complains that the branch does not exist, the `git fetch` did
not run — repeat both commands in order.

You can also read everything in a browser without touching git at all:

**https://github.com/breadwinners-np/bread-app/tree/chore/project-setup-docs**

---

## Fix 2 — merge the branch, so this stops happening

Fix 1 is a workaround. Until the branch is merged, every fresh clone will hit the
same thing. The real fix is to merge it.

**1.** Open the pull request:
https://github.com/breadwinners-np/bread-app/pull/new/chore/project-setup-docs
→ **Create pull request**. Either teammate can do this.

**2.** Read the documents, using Fix 1 or the browser link above. Start with
`HANDOFF.md` — it is the full context dump for the project.

**3.** Review the pull request properly. This part matters. `DECISIONS.md`
contains seven numbered decisions, and six of them are marked **Proposed**, not
Accepted. They are recommendations that nobody has agreed to yet:

- 0001 — monorepo holding both apps, the shared package, and the database
- 0002 — npm workspaces, with Turborepo deferred
- 0003 — `packages/shared` ships raw TypeScript, no build step
- 0004 — money stored as integer pesewas
- 0005 — one buyer app with role-branched screens, not two apps
- 0006 — build the admin app before the buyer app

Merging is what turns those from one person's proposals into the team's actual
decisions. If you disagree with any of them, now is the cheapest possible moment
to say so — no code depends on them yet. Comment on the pull request.

**4.** Click **Merge pull request**. You are an organization owner, so you can
merge it yourself.

**5.** Get the merged files locally:

```bash
git checkout main
git pull
```

`main` now has everything, and future clones will work normally.

---

## Confirming you have equal access

You should already have exactly the same access as the other teammate. To check:

Go to **https://github.com/orgs/breadwinners-np/people** and confirm you are
listed as **Owner**, not Member.

Owner means you can push branches, merge pull requests, change repository
settings, manage access, and administer the organization — the same as the other
teammate, with no tie-breaker between you. If it says Member instead, you have
push access but not settings or access management; ask to be promoted.

One thing that is *not* enforced: `main` is not mechanically protected. Branch
protection on a private repository requires a paid GitHub plan, so the
no-pushing-to-`main` rule is convention held by both of you rather than something
the platform blocks. Please follow it anyway.

---

## After the merge

1. Read `HANDOFF.md` end to end. It covers the business, the stack, exactly what
   exists so far, and what is deliberately not built yet.
2. Read `CLAUDE.md` for the architecture rules and the "do not" list.
3. Note that **nothing is scaffolded** — there is no `package.json`, no `apps/`,
   no Supabase project. Do not run `npm install`; there is nothing to install.
4. Before either of you writes code, agree on who owns what. Two people on a
   fresh monorepo will collide on the shared package and the database schema
   within a day. The suggested split is one person on Supabase (schema,
   migrations, row-level security) and the other on the admin UI.
5. Four business questions are blocking the schema and need answers from the
   bakery owner. They are listed at the top of `DECISIONS.md`.
