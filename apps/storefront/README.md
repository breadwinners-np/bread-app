# apps/storefront — demo customer ordering page

A standalone demo so the owner can show what placing an order and paying
could look like. **It is not `apps/mobile`**, the real buyer app described in
the root `CLAUDE.md` — that is still Expo/React Native and does not exist
yet. This is a quick, disposable Next.js prototype built to be shown to the
owner before deciding whether (and how) to build the real thing.

What it does:

- Lists the four products (butter, brown, sugar, mixfruit bread) from Supabase.
- Lets a customer open an account — name, phone, business or individual, area,
  address, and a four-digit PIN — and sign back into it later.
- Lets them build a cart, choose a delivery day and where the bread should go,
  and check out as their account.
- Shows them everything they have ordered before, on `/account`.
- "Pays" with a mocked Momo/card step — no money moves, and no Paystack
  account is required to try it.

**The two apps share one database.** A checkout here writes a real order and a
real confirmed payment, against the real customer signed in, in the same tables
`apps/admin` reads. So an order placed here appears on the owner's
Orders page tagged "Online", lands on her delivery round for the day the
customer chose, counts toward that customer's balance, and shows up in her
reports. She can cancel it. There is no separate demo data path.

A basket with several kinds of bread is **one order with several lines**, so
the owner sees the customer once with their breads underneath. A short drop
records how many of *each* bread arrived. See decision 0026.

**Signing in is a phone number and a PIN, which is deliberately demo-grade.**
The real buyer app confirms a number by SMS (open question AUTH-3, unanswered
because it costs money per message in Ghana). Decision 0027 lists exactly what
this does and does not protect — read it before putting this in front of
anyone with a real balance.

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
3. [`supabase/migrations/0003_lock_down_rpc_execution.sql`](../../supabase/migrations/0003_lock_down_rpc_execution.sql)
   — closes those functions to the publishable key. Not optional: without it
   anyone holding that key can mark an order paid. See decision 0024.
4. [`supabase/migrations/0004_customer_accounts_and_baskets.sql`](../../supabase/migrations/0004_customer_accounts_and_baskets.sql)
   — customer accounts and PINs, addresses, one order per basket, and how much
   of each bread arrived.

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
  server-side code using the secret key, never directly from the browser. A
  customer's session is this app's own signed cookie rather than a Supabase
  JWT, so there is still nothing for a database policy to scope "their own
  rows" by; the scoping happens in the queries, which always filter by the
  customer id in that cookie. See the migration headers.
- **Sessions are signed, and PINs are hashed.** The cookie holds the customer
  id and an HMAC of it, so editing it does not hand somebody another
  customer's history; it is `httpOnly`, so a script on the page cannot read
  it. PINs are stored as salted scrypt hashes in their own table, which no
  admin screen ever selects. Sign-in stops after five wrong tries in fifteen
  minutes — four digits is only ten thousand guesses. Decision 0027 lists what
  this still does not protect.
- **The cart is never trusted for price.** The browser only ever sends
  `productId` + `quantity`. `app/actions.ts` looks up the real, current price
  from the database before creating an order — a tampered cart cannot buy
  bread below its real price.
- **The service role key never reaches the client.** `lib/supabase-admin.ts`
  imports the `server-only` package, which turns an accidental client-side
  import into a build failure rather than a leaked secret.
- **An order is only readable by the customer it belongs to.** `/order/[id]`
  used to treat the UUID itself as the password. It now requires a session and
  filters on `customer_id`, so a shared link shows a stranger nothing.
- **Who an order belongs to comes from the session, never the form.** Nothing
  the browser sends decides which customer an order is written against, or
  which order a payment confirms.
- **Customers are matched by phone, and never renamed by a sign-up.** A unique
  index on the normalised number keeps one person to one record, and someone
  signing up with a number the owner already has cannot change the name, type
  or area she typed — only fill in the blanks.
- **Sign-up is open, and claiming needs only a phone number.** Anyone can
  create an account, and a customer the owner already has can be claimed by
  whoever signs up with their number first. Real number confirmation is
  AUTH-3. Fine behind a demo link; this must not be exposed publicly as it
  stands.

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
