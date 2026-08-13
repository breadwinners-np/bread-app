# Testing and verification

What is checked, how to run it, what it found, and what is still untested.

`DECISIONS.md` records *why* things are the way they are. This file records
*how we know they work*. When a check here exists because something was once
broken, that is said plainly — a test with a reason attached survives a refactor
that a nameless test does not.

---

## How to run everything

```bash
npm run typecheck
npm run lint
npm test
npm run verify:security
npm run verify:integrity
```

The demo loop reads the owner's rendered screens, so it needs both apps up:

```bash
npm run dev
npm run dev:storefront
npm run verify:demo
```

---

## The two kinds of test, and why both exist

**Unit tests** (`npm test`, vitest) cover the pure business logic in
`packages/shared` — money, dates, balances, the mapping from database rows to
domain objects. No database, no network.

**Verification scripts** (`scripts/verify/`) run against a real Supabase
project. They exist because the things they check *only exist in the database*:
row level security, function execute permissions, constraints, and transaction
boundaries. A mocked database would agree with whatever we assumed and prove
nothing — and the one real vulnerability found so far was invisible to every
unit test, because the application code was correct and the *permissions* were
not.

They create rows prefixed `ZZ Verify`, then delete them. Each run ends by
asserting nothing was left behind.

---

## `npm test` — the business rules

| File | Covers |
| --- | --- |
| `packages/shared/tests/logic.test.ts` | Money formatting and conversion, dates and calendars, order value, what a customer owes, payment application, reports |
| `packages/shared/tests/deliveries.test.ts` | How much of an order actually arrived — the rule that refuses to trust a submitted quantity |
| `packages/shared/tests/db-mapping.test.ts` | Phone normalisation and row-to-domain mapping |

Rules worth calling out, because getting them wrong costs real money:

- **Money never touches floating point.** `cedisToPesewas` is checked against
  the classic traps (`0.1 + 0.2`, `2.675`).
- **A submitted delivery quantity is decided, not trusted.** A full delivery is
  worth the whole order and a failed one nothing, whatever the form claims; only
  a part delivery uses the number, and it cannot exceed what was ordered.
- **An unconfirmed payment is not money.** A customer's claim from their phone
  counts for nothing until the owner agrees (decision 0013), except for
  gateway-verified card and mobile money, which is real money on arrival
  (decision 0022).
- **Timestamps are converted to UTC, not passed through.** Two callers derive a
  business day by slicing ten characters off a timestamp. A payment recorded at
  23:30 under a +01:00 offset belongs to the next day in UTC — a missed
  conversion moves money between days, and between months on the reports screen,
  with no error anywhere.
- **One phone number is one customer.** `normalisePhone` has a twin in SQL (the
  generated `phone_normalised` column in migration 0002). The test asserts both
  algorithms agree, because if they drift, a returning customer silently becomes
  a second record.

### Known gap: the unit tests do not currently run on this machine

`npm test` fails to start on **Node 20** — vitest's bundler cannot load its
native binding, and npm skipped the optional dependency as engine-incompatible.
The repo requires **Node >= 22** (`engines` in `package.json`).

This is an environment problem, not a code problem, but it means the unit suite
is **unverified locally**. It was worked around during the verification pass by
compiling `packages/shared` with `tsc` and running the assertions directly under
plain Node — 74 checks covering money, dates, orders, balances and phone
matching, all passing. That is a workaround, not a substitute. **Upgrade to Node
22 and run `npm test` before trusting the suite.**

---

## `npm run verify:security` — what a stranger can do

The publishable key ships inside every browser that loads the storefront, so it
is public in the only sense that matters. This script uses that key and nothing
else.

- The bread menu is readable, as the storefront needs.
- `customers`, `orders`, `order_items`, `deliveries`, `payments`, `costs`,
  `purchases` and `supply_items` return nothing.
- No order, customer, or price change can be written.
- Neither money function can be called.

### What this found: two exploitable holes (decision 0024)

Both `place_order` and `confirm_order_payment` were callable by anyone with the
publishable key. Proved, not inferred:

```
anon calling confirm_order_payment -> 200
order after the attack: {"payment_status":"paid","payment_reference":"STOLEN-BREAD"}
payments recorded: [{"amount_pesewas":70000,"confirmed_at":"..."}]
*** EXPLOITABLE ***
```

A stranger marked an unpaid GHS 700 order as **paid**, writing a *confirmed*
payment for money that never arrived. The owner's screen would have shown it
settled, and she would have baked and delivered against it. `place_order` was
equally open — orders at any price the caller chose, skipping the server action
that resolves real prices.

**Cause:** Postgres grants `EXECUTE` on a new function to `PUBLIC` by default,
and PostgREST publishes every function in the `public` schema as an RPC endpoint
the anon key can reach. Both functions are `security definer`, so they ran as
their owner — past the row level security that was otherwise the only thing
protecting those tables.

**Fix:** migration `0003_lock_down_rpc_execution.sql` revokes execute from
`public`, `anon` and `authenticated`, grants it to `service_role` alone, and
sets default privileges so the next function added to the schema starts closed.
Nothing legitimate lost access — both are only ever called from server-side code
holding the secret key.

**The general rule, now in `CLAUDE.md`:** RLS does not protect a function; a
`security definer` function exists to bypass it. Execute permission is the
control that matters, and it must be revoked explicitly. A migration adding a
function must say who may execute it, exactly as a new table must say who may
read it.

The checks in this script are the regression guard. If a future migration adds a
function and forgets, this fails.

---

## `npm run verify:integrity` — what the database guarantees

Rules that must hold even when the application code is wrong.

- **Placing an order is all-or-nothing.** The order, its line, and its delivery
  record are written in one transaction. Without it, a failure between writes
  leaves an order with no lines (which renders to the owner as a real delivery
  worth GHS 0.00) or an order with no delivery (which vanishes from the round
  while still counting toward what is owed). Both fail silently.
- **The total is computed from the lines**, never taken from the caller.
- **A price change never rewrites a past order.** Checked by actually raising a
  product's price and re-reading the order.
- **Money is recorded once.** A repeated `confirm_order_payment` is refused, so
  a double-clicked pay button cannot charge twice.
- **Impossible rows are refused** — zero and negative quantities, negative
  prices, more of a bread delivered than was ordered, a payment of nothing,
  invented payment methods, order sources, delivery statuses and customer
  types, a second delivery for one order, and a line on an order that does not
  exist.
- **One phone number is one customer**, and a public sign-up cannot rename or
  relocate a customer the owner already has.
- **Deleting an order takes its lines and delivery with it.**

---

## `npm run verify:demo` — the demo loop

Reads the owner's actual rendered screens, because a row existing in the
database is not the same as her seeing it.

A customer's two-bread basket is **one order** carrying both breads in the
order they picked them (decision 0026) → an unpaid order stays off her screen →
once paid it appears on Orders tagged **Online**, naming the customer once with
both breads under them, and cancellable → the customer appears in Customers →
the bread is on the round for the day the customer chose, at the address they
gave rather than their own → the payment appears on Payments and is *not*
sitting in her confirm queue → cancelling removes it from the round but keeps it
in history.

---

## Still untested

Recorded honestly rather than left implied.

1. **Browser interaction.** Every check drives the server and the database. The
   cart, the sign-up and sign-in forms, the checkout form (delivery day picker,
   deliver-somewhere-else), the per-bread part-delivery panel and the
   confirm-before-cancel panel are typechecked and render correctly, but no
   automated check has clicked them. **This needs a manual pass.**
2. **The unit suite on this machine** — see the Node 22 gap above.
3. **Customer accounts.** Sign-up, sign-in, the PIN lockout after five wrong
   tries, and the rule that an order page shows nothing to a customer it does
   not belong to are all unexercised by any script. Decision 0027 lists what
   this scheme is not designed to withstand. **This needs a manual pass too.**
4. **Paystack.** Payment is mocked (`confirmMockPayment`). The real integration
   is specified in `apps/storefront/README.md` and unwritten. The rule that
   matters when it is written: the client's success callback is never proof of
   payment; the server must verify with Paystack using the secret key before
   marking anything paid.
5. **Concurrency.** The double-payment guard is proved sequentially, not under
   two simultaneous requests. The guard is a single conditional `UPDATE`, so
   Postgres serialises it, but that reasoning is not backed by a test here.
6. **Anything at scale.** Every check runs against a handful of rows.
