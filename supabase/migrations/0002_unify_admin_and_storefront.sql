-- One database for both apps.
--
-- Migration 0001 gave the storefront its own small world: products, orders and
-- order_items describing a guest checkout. The admin app meanwhile ran entirely
-- on an in-memory mock store. This migration brings the rest of the admin
-- app's model into the database and joins the two, so an order placed by a
-- customer and an order the owner writes down by phone are the same kind of
-- thing, stored once.
--
-- Access model, unchanged from 0001 and applied to every new table here:
--   - products : publicly readable (the storefront menu). Never written by anon.
--   - all else : RLS enabled with NO anon/authenticated policies. Every read and
--                write goes through server-side code using the service role key.
--
-- There is still no customer auth, so there is no "their own rows" to scope a
-- customer policy by. Per CLAUDE.md the safer default is no direct client
-- access at all, rather than a broad read policy that would expose one
-- customer's orders — or the owner's costs and profit — to another.

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  -- Ghanaian numbers get written both ways: "+233 24 111 2233" and
  -- "0241112233" are one person. Generated rather than passed in, so the
  -- database is the only thing that decides when two numbers match.
  phone_normalised text generated always as (
    case
      when regexp_replace(phone, '[^0-9]', '', 'g') like '233%'
        then '0' || substring(regexp_replace(phone, '[^0-9]', '', 'g') from 4)
      else regexp_replace(phone, '[^0-9]', '', 'g')
    end
  ) stored,
  type text not null check (type in ('business', 'individual')),
  area text not null,
  notes text,
  -- Customers are archived, never deleted, so history survives.
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Not partial on archived_at: an archived customer keeps their number reserved,
-- because it is still the same person if they come back.
create unique index if not exists customers_phone_normalised_key
  on customers (phone_normalised);

alter table customers enable row level security;

-- ---------------------------------------------------------------------------
-- Orders — extend 0001's storefront-shaped table into the shared one
-- ---------------------------------------------------------------------------

alter table orders add column if not exists customer_id uuid references customers(id);
-- The day the bread is due. A plain `date`, not `timestamptz`, so PostgREST
-- returns a bare YYYY-MM-DD matching the domain type and the business day.
alter table orders add column if not exists delivery_date date;
alter table orders add column if not exists source text;
-- Status is DERIVED from the delivery (see orderStatusForDelivery in
-- packages/shared), never stored — the two could otherwise disagree. Only
-- cancellation is not derivable, so only cancellation is recorded.
alter table orders add column if not exists cancelled_at timestamptz;
-- Set when a delivery was moved to a later day, holding the day it was
-- originally due, so one order stays one obligation.
alter table orders add column if not exists rescheduled_from date;

-- Orders the owner writes down have no online payment and no guest details.
alter table orders alter column customer_name drop not null;
alter table orders alter column customer_phone drop not null;
alter table orders alter column payment_method drop not null;
alter table orders alter column total_pesewas drop not null;
alter table orders alter column payment_status drop default;
alter table orders alter column payment_status drop not null;

-- Card and mobile money arrive through the gateway; cash and cheque are what
-- the owner takes in hand. Both kinds of order live in this table now.
alter table orders drop constraint if exists orders_payment_method_check;
alter table orders add constraint orders_payment_method_check
  check (payment_method is null
         or payment_method in ('card', 'mobile_money', 'cash', 'cheque'));

-- Backfill anything already placed on the storefront before this migration,
-- so no existing order is left without a customer or a delivery day.
with candidates as (
  select
    o.customer_name,
    o.customer_phone,
    row_number() over (
      partition by case
        when regexp_replace(o.customer_phone, '[^0-9]', '', 'g') like '233%'
          then '0' || substring(regexp_replace(o.customer_phone, '[^0-9]', '', 'g') from 4)
        else regexp_replace(o.customer_phone, '[^0-9]', '', 'g')
      end
      order by o.created_at
    ) as rn
  from orders o
  where o.customer_id is null and o.customer_phone is not null
)
insert into customers (name, phone, type, area, notes)
select customer_name, customer_phone, 'individual', 'Not given', 'Created from an online order'
from candidates
where rn = 1
on conflict (phone_normalised) do nothing;

update orders o
set customer_id = c.id
from customers c
where o.customer_id is null
  and o.customer_phone is not null
  and c.phone_normalised = case
    when regexp_replace(o.customer_phone, '[^0-9]', '', 'g') like '233%'
      then '0' || substring(regexp_replace(o.customer_phone, '[^0-9]', '', 'g') from 4)
    else regexp_replace(o.customer_phone, '[^0-9]', '', 'g')
  end;

update orders set delivery_date = created_at::date where delivery_date is null;
update orders set source = 'app' where source is null;

alter table orders alter column delivery_date set not null;
alter table orders alter column source set not null;

alter table orders drop constraint if exists orders_source_check;
alter table orders add constraint orders_source_check check (source in ('admin', 'app'));

create index if not exists orders_delivery_date_idx on orders (delivery_date);
create index if not exists orders_customer_id_idx on orders (customer_id);

-- ---------------------------------------------------------------------------
-- Deliveries — exactly one per order
-- ---------------------------------------------------------------------------

-- The unique constraint is load-bearing, not decorative: every read path in the
-- admin app looks a delivery up with .find() rather than .filter(), and
-- PostgREST guarantees no row order. A second delivery row would make the
-- day's round and the customer's balance disagree, differently on each refresh.
create table if not exists deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'delivered', 'partial', 'not_delivered')),
  -- What actually arrived, which may differ from what was ordered.
  delivered_quantity integer not null default 0 check (delivered_quantity >= 0),
  delivered_at timestamptz,
  note text
);

alter table deliveries enable row level security;

-- Every order placed before this migration needs its delivery record, or it
-- would vanish from the day's round while still counting toward what is owed.
insert into deliveries (order_id, status, delivered_quantity)
select o.id, 'pending', 0
from orders o
where not exists (select 1 from deliveries d where d.order_id = o.id);

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  -- The order this settles, when it was tied to one. Left null for a lump sum
  -- on the account — a monthly cheque covering many days of bread.
  order_id uuid references orders(id) on delete set null,
  amount_pesewas integer not null check (amount_pesewas > 0),
  -- 'card' only ever arrives from the payment gateway; the owner has no card
  -- terminal, so her own entry form does not offer it.
  method text not null check (method in ('cash', 'cheque', 'mobile_money', 'card')),
  reference text,
  note text,
  source text not null check (source in ('admin', 'app')),
  recorded_at timestamptz not null default now(),
  -- Money the owner agrees arrived. She confirms her own entries as she saves
  -- them. A payment a customer merely reports arrives null and counts for
  -- nothing until she agrees (decision 0013) — but a gateway-verified card or
  -- mobile money payment is real money and is written already confirmed.
  confirmed_at timestamptz,
  rejected_at timestamptz
);

alter table payments enable row level security;

create index if not exists payments_customer_id_idx on payments (customer_id);
create index if not exists payments_order_id_idx on payments (order_id);

-- ---------------------------------------------------------------------------
-- Spending: supplies bought, and costs with nothing countable to buy
-- ---------------------------------------------------------------------------

create table if not exists supply_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  default_unit text not null
    check (default_unit in ('piece', 'kg', 'g', 'litre', 'sack', 'box', 'crate')),
  category text not null check (category in ('gas', 'ingredients', 'transport')),
  active boolean not null default true
);

alter table supply_items enable row level security;

create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references supply_items(id),
  date date not null,
  -- Fractional on purpose: 2.5 kg of butter is a normal purchase, and an
  -- integer column would silently round it to 3 and overstate the cost.
  quantity numeric not null check (quantity > 0),
  unit text not null
    check (unit in ('piece', 'kg', 'g', 'litre', 'sack', 'box', 'crate')),
  unit_price_pesewas integer not null check (unit_price_pesewas > 0),
  supplier text,
  note text,
  recorded_at timestamptz not null default now()
);

alter table purchases enable row level security;

create index if not exists purchases_date_idx on purchases (date);

create table if not exists costs (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  category text not null check (category in ('gas', 'ingredients', 'transport')),
  amount_pesewas integer not null check (amount_pesewas > 0),
  note text
);

alter table costs enable row level security;

create index if not exists costs_date_idx on costs (date);

-- ---------------------------------------------------------------------------
-- place_order — one order, its lines and its delivery, or none of them
-- ---------------------------------------------------------------------------
--
-- Without a transaction here, a failure between the writes leaves an order with
-- no lines (which renders to the owner as a real delivery worth GHS 0.00) or an
-- order with no delivery (which disappears from the round while still counting
-- toward what is owed). Both are silent.
--
-- Prices are resolved and snapshotted by the caller before this is called, so
-- the money rule stays in packages/shared and out of SQL. This function is a
-- transaction wrapper, not a place where business logic lives.

create or replace function place_order(
  p_customer_id uuid,
  p_delivery_date date,
  p_source text,
  p_lines jsonb,
  p_payment_method text default null,
  p_payment_status text default null,
  p_delivery_note text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_total integer;
begin
  if jsonb_array_length(p_lines) = 0 then
    raise exception 'An order needs at least one line';
  end if;

  select sum((line->>'unit_price_pesewas')::integer * (line->>'quantity')::integer)
  into v_total
  from jsonb_array_elements(p_lines) as line;

  insert into orders (
    customer_id, delivery_date, source, payment_method, payment_status,
    delivery_note, total_pesewas
  )
  values (
    p_customer_id, p_delivery_date, p_source, p_payment_method, p_payment_status,
    p_delivery_note, v_total
  )
  returning id into v_order_id;

  insert into order_items (order_id, product_id, product_name, unit_price_pesewas, quantity)
  select
    v_order_id,
    (line->>'product_id')::uuid,
    line->>'product_name',
    (line->>'unit_price_pesewas')::integer,
    (line->>'quantity')::integer
  from jsonb_array_elements(p_lines) as line;

  insert into deliveries (order_id, status, delivered_quantity)
  values (v_order_id, 'pending', 0);

  return v_order_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- confirm_order_payment — mark an order paid and record the money, together
-- ---------------------------------------------------------------------------
--
-- The `payment_status = 'pending'` guard is what makes a double-clicked pay
-- button harmless: only the first call updates a row, so only the first call
-- inserts a payment. Without the two in one transaction, a retry could record
-- the same money twice and push the customer's balance negative.
--
-- Returns the new payment id, or null if the order was already handled.

create or replace function confirm_order_payment(
  p_order_id uuid,
  p_reference text,
  p_method text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_amount integer;
  v_payment_id uuid;
begin
  update orders
  set payment_status = 'paid', payment_reference = p_reference, payment_method = p_method
  where id = p_order_id and payment_status = 'pending'
  returning customer_id, total_pesewas into v_customer_id, v_amount;

  -- FOUND rather than a null check on the returned columns: an order with no
  -- customer would otherwise look identical to one that was already paid.
  if not found then
    return null;
  end if;

  if v_customer_id is null then
    raise exception 'Order % has no customer to credit the payment to', p_order_id;
  end if;

  -- Gateway-verified money, so it is confirmed on arrival rather than waiting
  -- on the owner. Decision 0013's "a customer's word is a claim" rule is about
  -- payments nobody can verify, which this is not.
  insert into payments (
    customer_id, order_id, amount_pesewas, method, reference, source, confirmed_at
  )
  values (
    v_customer_id, p_order_id, v_amount, p_method, p_reference, 'app', now()
  )
  returning id into v_payment_id;

  return v_payment_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Seed — the owner's existing book, ported from the admin app's mock store
-- ---------------------------------------------------------------------------
--
-- Deliberately small. The demo fills the rest by placing real orders on the
-- storefront, and a wall of seeded rows would bury them. What is here covers
-- the states a fresh online order cannot show on its own: delivered in full,
-- part delivered, and a drop that failed and is still waiting on her.
--
-- Fixed ids so the seed is re-runnable and the relationships are readable.

insert into customers (id, name, phone, type, area, notes) values
  ('10000000-0000-4000-8000-000000000001', 'Baatsonaa Total', '+233 24 111 2233', 'business', 'Osu', 'Monthly agreement, pays by cheque. Delivery before 7am.'),
  ('10000000-0000-4000-8000-000000000002', 'Adom Provisions', '+233 20 444 5566', 'business', 'Madina', 'Confirms quantity by text each month.'),
  ('10000000-0000-4000-8000-000000000003', 'Grace Mensah', '+233 55 777 8899', 'individual', 'Labone', null),
  ('10000000-0000-4000-8000-000000000004', 'Kofi Owusu', '+233 26 222 3344', 'individual', 'East Legon', null),
  ('10000000-0000-4000-8000-000000000005', 'Akosua Boateng', '+233 27 888 1122', 'individual', 'Cantonments', 'Prefers butter bread.')
on conflict (id) do nothing;

insert into orders (id, customer_id, delivery_date, source, created_at) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', current_date, 'admin', now()),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000005', current_date, 'admin', now()),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', current_date + 1, 'admin', now()),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', current_date - 1, 'admin', now() - interval '1 day'),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000004', current_date - 2, 'admin', now() - interval '2 days')
on conflict (id) do nothing;

insert into order_items (order_id, product_id, product_name, unit_price_pesewas, quantity)
select v.order_id::uuid, p.id, p.name, p.price_pesewas, v.quantity
from (values
  ('20000000-0000-4000-8000-000000000001', 'sugar-bread', 120),
  ('20000000-0000-4000-8000-000000000002', 'butter-bread', 10),
  ('20000000-0000-4000-8000-000000000003', 'sugar-bread', 120),
  ('20000000-0000-4000-8000-000000000004', 'brown-bread', 60),
  ('20000000-0000-4000-8000-000000000005', 'sugar-bread', 5)
) as v(order_id, slug, quantity)
join products p on p.slug = v.slug
where not exists (select 1 from order_items oi where oi.order_id = v.order_id::uuid);

update orders o
set total_pesewas = t.total
from (
  select order_id, sum(unit_price_pesewas * quantity) as total
  from order_items group by order_id
) t
where o.id = t.order_id and o.total_pesewas is null;

insert into deliveries (order_id, status, delivered_quantity, delivered_at, note) values
  ('20000000-0000-4000-8000-000000000001', 'delivered', 120, now() - interval '6 hours', null),
  ('20000000-0000-4000-8000-000000000002', 'pending', 0, null, null),
  ('20000000-0000-4000-8000-000000000003', 'pending', 0, null, null),
  ('20000000-0000-4000-8000-000000000004', 'partial', 45, now() - interval '1 day', 'Shop was closed, left what they took'),
  ('20000000-0000-4000-8000-000000000005', 'not_delivered', 0, now() - interval '2 days', 'Nobody at the house, phone off')
on conflict (order_id) do nothing;

-- Between them these cover every state the payments screen can show: a lump sum
-- spread across several days of bread, a payment tied to one order, and a
-- customer's own claim waiting to be confirmed.
insert into payments (id, customer_id, order_id, amount_pesewas, method, reference, note, source, recorded_at, confirmed_at) values
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', null, 288000, 'cheque', 'Cheque 004821 — GCB', 'Covers the first part of the month', 'admin', now() - interval '2 days', now() - interval '2 days'),
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000005', 6000, 'mobile_money', 'MoMo 8891', null, 'admin', now() - interval '2 days', now() - interval '2 days'),
  ('40000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000002', 10000, 'cash', null, null, 'admin', now() - interval '1 day', now() - interval '1 day'),
  ('40000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000004', 7200, 'mobile_money', 'MoMo 4471', null, 'app', now(), null)
on conflict (id) do nothing;

insert into supply_items (id, name, default_unit, category) values
  ('50000000-0000-4000-8000-000000000001', 'Flour', 'sack', 'ingredients'),
  ('50000000-0000-4000-8000-000000000002', 'Yeast', 'kg', 'ingredients'),
  ('50000000-0000-4000-8000-000000000003', 'Butter', 'kg', 'ingredients'),
  ('50000000-0000-4000-8000-000000000004', 'Sugar', 'kg', 'ingredients'),
  ('50000000-0000-4000-8000-000000000005', 'Gas cylinder', 'piece', 'gas')
on conflict (id) do nothing;

insert into purchases (id, item_id, date, quantity, unit, unit_price_pesewas, supplier, note, recorded_at) values
  ('60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', current_date, 4, 'sack', 30000, 'Kwame''s Mill', null, now()),
  ('60000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000005', current_date, 1, 'piece', 45000, 'Total Baatsonaa', 'Furnace refill', now()),
  ('60000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000002', current_date - 1, 2, 'kg', 9000, 'Makola market', null, now() - interval '1 day'),
  ('60000000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000003', current_date - 1, 5, 'kg', 6000, 'Makola market', null, now() - interval '1 day'),
  ('60000000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-000000000004', current_date - 1, 25, 'kg', 1800, 'Makola market', null, now() - interval '1 day')
on conflict (id) do nothing;

-- Costs that have no countable item. Anything bought by the sack, kilo or
-- cylinder is a purchase instead, so nothing is counted in both places.
insert into costs (id, date, category, amount_pesewas, note) values
  ('70000000-0000-4000-8000-000000000001', current_date, 'transport', 18000, 'Fuel for the van'),
  ('70000000-0000-4000-8000-000000000002', current_date - 1, 'transport', 16000, null),
  ('70000000-0000-4000-8000-000000000003', current_date - 2, 'transport', 17000, 'Fuel for the van')
on conflict (id) do nothing;
