# apps/storefront — demo customer ordering page

A standalone demo so the owner can show what placing an order and paying
could look like. **It is not `apps/mobile`**, the real buyer app described in
the root `CLAUDE.md` — that is still Expo/React Native and does not exist
yet. This is a quick, disposable Next.js prototype built to be shown to the
owner before deciding whether (and how) to build the real thing.

What it does:

- Lists the four products (butter, brown, sugar, mixfruit bread) from Supabase.
- Lets a visitor build a cart, choose a delivery day, and check out with their
  name, phone and delivery area — no login.
- "Pays" with a mocked Momo/card step — no money moves, and no Paystack
  account is required to try it.

**The two apps share one database.** A checkout here creates (or matches, by
phone number) a real customer, real orders, and a real confirmed payment in the
same tables `apps/admin` reads. So an order placed here appears on the owner's
Orders page tagged "Online", lands on her delivery round for the day the
customer chose, counts toward that customer's balance, and shows up in her
reports. She can cancel it. There is no separate demo data path.

One deliberate wrinkle: a basket with several kinds of bread becomes **one
order per bread type**, because the owner's delivery sheet is written one bread
at a time and a short drop has to be able to say which bread was short. That is
open question ORD-12; see `DECISIONS.md`.

## One-time setup

### 1. Create a Supabase project

Free tier is fine. Once created, copy:

- **Project settings → Data API** — the Project URL
- **Project settings → API Keys** — the Publishable key and the Secret key
  (newer projects use these names; older ones show "anon public" and
  "service_role" instead — same two keys). The secret key is exactly that:
  never share it, never put it in a client component, never commit it.

### 2. Run the migrations

Open the Supabase project's **SQL editor** and run these in order:

1. [`supabase/migrations/0001_storefront_catalog_and_orders.sql`](../../supabase/migrations/0001_storefront_catalog_and_orders.sql)
   — products, orders, order items, and the four breads.
2. [`supabase/migrations/0002_unify_admin_and_storefront.sql`](../../supabase/migrations/0002_unify_admin_and_storefront.sql)
   — customers, deliveries, payments, spending, the two transaction functions,
   and the owner's starting book.

### 3. Configure environment variables

Both apps need credentials for the **same** project:

```bash
cp apps/storefront/.env.example apps/storefront/.env.local
cp apps/admin/.env.example apps/admin/.env.local
```

Fill in the Supabase values from step 1 — the admin app needs the URL and the
secret key, the storefront needs those plus the publishable key. Leave the two
Paystack variables blank for now; see below.

### 4. Run both apps

Needs **Node 22 or later** (see `engines` in the root `package.json`). On Node
20 the test runner's native dependency is skipped as incompatible and
`npm test` cannot start.

From the repo root, in two terminals:

```bash
npm install
npm run dev
npm run dev:storefront
```

Admin is **http://localhost:3000**, the storefront **http://localhost:3001**.

## Security model, and why it's built this way

- **RLS on every table.** `products` is public-read. Everything else has RLS
  enabled but *no* policies for `anon` — every read and write happens through
  server-side code using the secret key, never directly from the browser. There
  is no customer login yet, so there is no "their own rows" to scope a customer
  policy by, and a broad read policy would expose one customer's orders (or the
  owner's costs and profit) to another. See the migration headers.
- **The cart is never trusted for price.** The browser only ever sends
  `productId` + `quantity`. `app/actions.ts` looks up the real, current price
  from the database before creating an order — a tampered cart cannot buy
  bread below its real price.
- **The service role key never reaches the client.** `lib/supabase-admin.ts`
  imports the `server-only` package, which turns an accidental client-side
  import into a build failure rather than a leaked secret.
- **Order confirmation links are capability URLs.** `/order/[id]` has no
  login check — the UUID itself is the "password". That's fine for a demo
  link shared with one person, but it means anyone who gets the link can see
  that order. A production version should require the customer to be logged
  in (the phone-OTP flow already planned in the root `CLAUDE.md`) and scope
  the query to their own orders.
- **Customers are matched by phone, and never renamed by a checkout.** Two
  people ordering at once from the same new number cannot create two customer
  records (a unique index on the normalised number), and someone entering a
  number that already belongs to a wholesale customer cannot rename them from
  this form.
- **Not rate limited, and no auth.** Anyone with the URL can create orders and
  customer records. Fine behind a demo link; this must not be exposed publicly
  as it stands.

## Upgrading the mocked payment to real Paystack

Payment is currently mocked in `app/actions.ts` (`confirmMockPayment`) so
this can be demoed without a Paystack account. To wire in the real thing:

1. Create a Paystack account, grab the **test** public and secret keys from
   **Settings → API Keys & Webhooks**, and set `PAYSTACK_PUBLIC_KEY` /
   `PAYSTACK_SECRET_KEY` in `.env.local`. **Use test keys only** until this
   has had a real security review — never a live secret key in a demo app.
2. On the client (checkout page), replace the "Simulate payment" button with
   Paystack's Inline JS popup (`PaystackPop.setup`), initialized with
   `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`, `email`/`phone`, the amount in
   pesewas, and `channels: ["card", "mobile_money"]` for GHS.
3. On the popup's success callback, call a server action with the
   transaction `reference` — do **not** treat the callback firing as proof
   of payment; a browser can be made to call it without a real charge.
4. That server action calls Paystack's
   `GET https://api.paystack.co/transaction/verify/:reference` with
   `Authorization: Bearer ${PAYSTACK_SECRET_KEY}` (server-side only), checks
   `status === "success"` **and** that the returned amount/currency match the
   order, and only then updates `orders.payment_status` to `paid`. This
   mirrors exactly what `confirmMockPayment` does today, just with a real
   verification call instead of an automatic success.
5. For production (not this demo), also add a Paystack webhook endpoint as a
   second, independent confirmation path, since a customer closing the tab
   right after paying would otherwise never trigger the verify call.
