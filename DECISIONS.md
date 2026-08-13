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
- **~~The bread list (PRD-5)~~ — ANSWERED, see 0020.** The four are butter,
  brown, sugar and mixfruit. **Prices are still placeholders** and need
  confirming with her.
- **~~Several breads on one order (ORD-12)~~ — ANSWERED, see 0026.** A basket
  is one order carrying several breads, and a short drop records how many of
  *each* bread arrived. Supersedes 0010 and 0023.
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
- **~~Supply catalogue (INV-2)~~ — ANSWERED, see 0028.** She can type in
  anything the list does not have, and buying it adds it to the list.
- **Price changes (INV-3).** Purchases record the price paid each time, so a
  supplier's price rising is visible in the history. Does she want to be warned
  when a price moves, and by how much?
- **Phone OTP budget (AUTH-3).** Supabase phone auth needs an SMS provider billed
  per message in Ghana. Is there a budget, or should admin use email + password?
  **Still open.** Customers now sign in with a phone number and a PIN, which
  needs no SMS — see 0027, which is explicitly an interim answer, not this one.
- **Owner-entered orders (ORD-11).** Confirming the assumption that admin can
  create an order for a customer who phones in and never installs the app.
- **Tax (TAX-1).** Do receipts and invoices need Ghana VAT and levies, or is this
  informal for v1?

Working defaults unless told otherwise: English only, dates `DD/MM/YYYY`,
Africa/Accra is UTC+0 with no daylight saving, business day is midnight to
midnight local.

---

## 0028 — She can type in a supply the list does not have

**Date:** 2026-08-13 · **Status:** Proposed · **Answers INV-2**

"Record something you bought" offered a fixed list — flour, yeast, butter,
sugar, gas — and nothing else. A bakery buys things nobody thought of, and a
purchase she cannot record is not a tidy list, it is a cost missing from her
reports and a profit figure that is too high.

The picker now ends in **"Something else — let me type it"**, which asks for a
name and which kind of cost it is, then adds it to the list so next time she
just picks it. An item she has bought before is matched on its name ignoring
case and spacing, so "Baking soda" and "baking soda " stay one line in her
spending rather than two.

**Which kind of cost is asked, not guessed.** It decides which line of the
report the money lands on, and a wrong guess there is a wrong report. The three
kinds are the ones already in use: gas and fuel, ingredients, transport.

**Tradeoff:** the list grows, and a typo makes a near-duplicate she cannot
remove from this screen. Deactivating a supply is a database edit today. If the
list gets messy in practice, editing it needs its own screen.

## 0027 — Customers sign in with a phone number and a PIN

**Date:** 2026-08-13 · **Status:** Proposed

Ordering on the storefront needed a name, a phone number and an address typed
fresh every single time, and matched the person to a customer record by that
number. Anyone ordering twice was one person if they typed the number the same
way both times, and two people if they did not. The owner ended up with several
records for the same customer, each holding part of a balance.

A customer now **opens an account before they can order**: name, phone,
business or individual, area, address, and a four-digit PIN. Ordering is done
as that account, so the order joins one history that both they and the owner
can see. `orders.customer_id` comes from the signed cookie and never from the
form, so nobody can order in somebody else's name.

**Business or individual is asked outright.** Every checkout used to create an
`individual`, which was wrong for exactly the customers who matter most — the
wholesale ones — and the owner's screens treat the two differently.

**Why a PIN and not the phone OTP in CLAUDE.md.** OTP needs an SMS provider
billed per message in Ghana, which is AUTH-3 and unanswered. A PIN costs
nothing, works the moment the migration is applied, and is a familiar idea to
anyone who uses mobile money. **This is an interim, not an answer to AUTH-3.**

**What it is and is not.** The PIN is stored as a salted scrypt hash, never in
the clear; sign-in gives up after five wrong tries in fifteen minutes, because
four digits is ten thousand guesses; a wrong number and a wrong PIN give the
same message, so this cannot be used to find out who has an account; and the
session is an HMAC-signed, http-only cookie, so editing it does not hand
somebody another customer's history.

Three things are honestly demo-grade, and all three are fixed by real auth
rather than by patching this:

- **Claiming works on the phone number alone.** A customer the owner already
  had in her book gets an account by signing up with their number — otherwise
  every existing customer is locked out of the app forever. Somebody who knows
  that number could get there first. OTP confirms the number; a PIN cannot.
- **Attempt counting is in memory**, so it resets when the server restarts and
  is not shared between instances.
- **There is no server-side session**, so signing out on one device does not
  end the session on another, and a stolen cookie is valid until it expires.

The owner's own record of a customer wins over what a claimer types: her name,
type and area stand, and only blanks are filled in. Otherwise a public form
could rename a wholesale customer.

**Also here:** an order carries its own `delivery_address`, defaulted to the
customer's address but always asked. Where someone lives is not where the bread
goes — offices, churches and relatives are ordinary. The owner's round shows
the order's address, falling back to the customer's area.

The admin app still has no authentication at all (0009). Nothing here changes
that, and it is still the thing that has to happen before real data.

## 0026 — One basket is one order, and a short drop says which bread

**Date:** 2026-08-13 · **Status:** Proposed · **Supersedes 0023 and 0010 ·
Answers ORD-12**

A customer who ordered butter bread and brown bread became **two orders**, and
appeared twice on the owner's screen. That was decision 0023, taken because
recording a short delivery against several breads would have needed an answer
to ORD-12. The owner has now said plainly that she wants the person once, with
what they ordered listed underneath.

So: one basket is one order with several lines. Orders, the delivery round,
Today, and a customer's history all show the customer once with their breads
stacked under the name.

**What that forced, and what it is worth.** With several breads on an order,
"they took 8 of the 15" cannot say *which* 8 — and the breads are not the same
price, so filling the lines in array order (what the old code did) would charge
for bread nobody received. `order_items.delivered_quantity` now records what
arrived **per bread**, and "Only some of it" asks a number for each. There is a
regression test for the case that made this necessary: two ways of being short
by three loaves, GHS 6 apart.

This does **not** answer DST-7 — whether a short drop reduces what is owed is
still open, and still resolved the same way (decision 0012: they are charged
for what arrived). It only makes the amount arrived exact rather than guessed.

**Costs:** recording a delivery is two tables again rather than the single
write 0021 arranged, so it goes through a `record_delivery` transaction. Order
lines carry an explicit `position`, because every line of an order is inserted
in one statement and shares a `created_at` to the microsecond — ordering by
that alone let the breads swap places between refreshes.

## 0025 — A negative balance reads as "in credit", never "you owe them"

**Date:** 2026-08-13 · **Status:** Proposed · **Touches PAY-6**

The admin Customers screen showed a customer who had paid ahead of delivery as
**"you owe them GHS X"**. That is arithmetically true — `balance = delivered −
paid`, so a customer who prepaid goes negative — but it reads alarmingly to a
non-technical owner. A wholesale customer like Baatsonaa Total who pays the
month's cheque up front sits deep in negative all month, and the screen made it
look as though the bakery had run up a debt, when in fact the customer is simply
owed **bread not yet delivered**.

Decision: display a negative balance as credit, not as a debt the owner owes.
The Customers list now says **"in credit — bread still to come"**, and the
customer detail tile flips its label to **"They are in credit"** with the hint
**"Paid ahead — bread still to deliver"**. Wording only — the balance
arithmetic is untouched, and money moves the same way it always did.

This does **not** answer **PAY-6**. Whether a customer may go into credit at
all, and up to what limit, is still open — this only fixes how an
already-possible negative balance is described. If PAY-6 later forbids credit,
this wording stops appearing on its own.

---

## 0024 — Database functions are closed to the public key by default

**Date:** 2026-08-13 · **Status:** Proposed

`place_order` and `confirm_order_payment` (migration 0002) were reachable by
anyone holding the **publishable key**, which ships inside every browser that
loads the storefront. Testing with that key confirmed both were exploitable:

- `confirm_order_payment` marked an unpaid order **paid** and wrote a
  *confirmed* payment for GHS 700 that never arrived. The owner's screen would
  have shown it as settled, and she would have baked and delivered against it.
- `place_order` created orders directly, at any price the caller chose,
  skipping the server action that resolves real prices from the database.

Two defaults combined to cause it. Postgres grants `EXECUTE` on a new function
to `PUBLIC`, and PostgREST publishes every function in the `public` schema as
an RPC endpoint the anon key can reach. Both functions are `security definer`,
so they ran as their owner — past the row level security that is otherwise the
only thing protecting these tables.

Migration 0003 revokes execute from `public`, `anon` and `authenticated`,
grants it to `service_role` alone, and sets default privileges so the next
function added to this schema starts closed. Nothing legitimate lost access:
both are only ever called from server-side code holding the secret key.

**The general rule: RLS does not protect a `security definer` function — it
exists to bypass RLS. For a function, execute permission is the control that
matters, and it has to be revoked explicitly.** Any future migration adding a
function must say who may execute it, the same way a new table must say who may
read it.

## 0023 — A basket of several breads becomes one order per bread

**Date:** 2026-08-09 · **Status:** Proposed

The customer storefront lets someone put butter and brown bread in one basket.
That basket is written as **two orders for the same day**, not one order with
two lines.

Commit `7f0e0ad` made an order carry several bread types and was reverted the
same evening in `d0630ad`, with no reason recorded (see 0010). Rebuilding it
here would have repeated that, and it would have forced answers to two open
questions nobody has asked the owner: whether a short drop must say *which*
bread was short (ORD-12), and whether a shortfall changes what is owed (DST-7).
`Delivery` still carries a single `deliveredQuantity` with no per-line
breakdown, so a three-bread order that arrives half-full cannot say what
arrived — the value would be guessed by filling lines in array order.

One order per bread type sidesteps all of it: every order stays exactly one
bread, one quantity, one price, and the delivery round reads the way the owner
already writes it down. The cost is that a basket shows as several rows on her
Orders screen.

**If the owner says she wants one order per basket, this is the entry to
supersede — and ORD-12 and DST-7 have to be answered first, not alongside.**

## 0022 — Gateway payments are confirmed on arrival

**Date:** 2026-08-09 · **Status:** Proposed

Decision 0013 says a payment reported from a customer's phone is a *claim* that
counts for nothing until the owner confirms it. That rule is about money nobody
can verify — a customer saying they sent cash or posted a cheque.

A card or mobile money payment taken through the payment gateway is not that.
The gateway is the authority on whether the charge succeeded, and the server
verifies it independently before the order is marked paid. So those payments are
written with `confirmedAt` already set, and appear in the owner's balances and
reports immediately rather than queueing for her approval.

This narrows 0013 rather than replacing it: a customer *claiming* they paid by
mobile money outside the app is still a claim.

## 0021 — An order's status is derived from its delivery

**Date:** 2026-08-09 · **Status:** Proposed

`orders` does not store a status column. Status is computed from the delivery
via `orderStatusForDelivery`, which is the function that already decided it.
Only `cancelled_at` is stored, because cancellation is the one order state no
delivery outcome implies.

Storing both let them disagree, and made recording a delivery a two-table
write: a failure between the two would leave a delivery marked done against an
order still reading as scheduled, silently. Recording a delivery and moving one
to another day are now single-table writes.

## 0020 — The four breads are butter, brown, sugar and mixfruit

**Date:** 2026-08-09 · **Status:** Proposed · **Answers PRD-5**

The prototype's sugar / tea / butter list was fabricated. The four above came
from the owner's side and are now the single product list both apps read. "Tea
bread" is gone.

This is the half of the reverted commit `7f0e0ad` that was worth keeping (see
0010, which flagged exactly this list as unconfirmed business fact). Prices are
still placeholders and need confirming with her.

## 0019 — One database for both apps, with the business logic left alone

**Date:** 2026-08-09 · **Status:** Proposed · **Supersedes 0008**

The admin app ran on an in-memory mock store while the storefront wrote to
Supabase, bridged by a read-only shim that faked a customer id and used an
order's creation date as its delivery day. Storefront orders could not be
delivered, paid, cancelled, or attributed to anyone. Every feature had to be
built twice or landed on one side only.

Both apps now read and write the same tables. A checkout creates or matches a
real customer by phone number, real orders, a real delivery record and a
confirmed payment.

**What was deliberately not done:** the aggregation and allocation logic in
`packages/shared` — `buildReport`, `customerAccount`, `deliveredValuePesewas` —
was not rewritten as SQL. Those are pure functions over plain arrays, they are
tested, and the mobile app will need the same answers. The data layer loads the
tables and hands them over unchanged, memoised per request. That is a deliberate
trade of scale for correctness: it holds to roughly a thousand orders, well past
anything this business will see before the schema is revisited, and the loaders
throw rather than silently truncate if it is ever approached.

The schema was previously blocked on the open questions above. It is unblocked
only for what the demo needs — the open questions are still open, and nothing
here answers ORD-3, PAY-3, PAY-6, DST-7 or RSC-1.

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

**Yesterday** joined Today, Last 7 days, This month and Last month as a preset,
because it is the most recent day that is actually finished — today is still
happening, so its figures move under her. The presets live in `@bread/shared`
next to the function that resolves them, so the phone app cannot end up with a
different idea of what "last month" means.

## 0016 — Orders and deliveries are read as a month, not as a list

**Date:** 2026-07-29 · **Status:** Proposed · **Asked for by the owner's daughter**

Orders could only be read as one long list of every order ever written down, and
deliveries only a day at a time through previous/next arrows. Both now have a
**month calendar**: each day shows what is going out on it, and tapping a day
opens that day.

**Which one each screen opens on differs, deliberately.** Deliveries opens on
the day's round, because that is the screen she works through every morning.
Orders opens on the **list**, because it answers "what have I written down"
without making her pick a day first; its calendar is one click away for the
other question — "what is going out that day" — which is mostly what somebody
standing in for her needs.

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
