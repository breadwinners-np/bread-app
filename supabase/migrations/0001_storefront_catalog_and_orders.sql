-- Storefront demo: product catalog and guest orders.
--
-- Access model (guest checkout, no customer auth yet):
--   - products  : publicly readable (anon + authenticated). Never written by anon.
--   - orders    : no anon/authenticated policies at all. Every read and write goes
--                 through apps/storefront server actions using the service role key,
--                 which bypasses RLS by design. Nothing here is reachable from the
--                 browser directly.
--   - order_items: same as orders — service role only.
--
-- This mirrors CLAUDE.md's rule that a customer can read only their own data:
-- since there is no auth yet to scope "their own" by, the safer default is no
-- direct client access at all, not a broad read policy.

create extension if not exists "pgcrypto";

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  unit text not null default 'loaf',
  price_pesewas integer not null check (price_pesewas > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table products enable row level security;

create policy "Products are publicly readable"
  on products for select
  to anon, authenticated
  using (active = true);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_phone text not null,
  delivery_note text,
  payment_method text not null check (payment_method in ('card', 'mobile_money')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed')),
  -- Paystack's transaction reference, once real payments are wired in.
  payment_reference text,
  total_pesewas integer not null check (total_pesewas > 0),
  created_at timestamptz not null default now()
);

alter table orders enable row level security;
-- Deliberately no policies: orders are created and read only by server-side
-- code using the service role key. See the header comment.

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  -- Snapshotted at order time (CLAUDE.md: a price change must never rewrite a
  -- past order), matching packages/shared's OrderLine.
  product_name text not null,
  unit_price_pesewas integer not null check (unit_price_pesewas > 0),
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

alter table order_items enable row level security;
-- Deliberately no policies: same reasoning as orders.

create index if not exists order_items_order_id_idx on order_items(order_id);

-- Seed the four demo products. Prices are placeholders — edit freely.
insert into products (slug, name, unit, price_pesewas) values
  ('butter-bread', 'Butter bread', 'loaf', 1800),
  ('brown-bread', 'Brown bread', 'loaf', 1400),
  ('sugar-bread', 'Sugar bread', 'loaf', 1200),
  ('mixfruit-bread', 'Mixfruit bread', 'loaf', 2000)
on conflict (slug) do nothing;
