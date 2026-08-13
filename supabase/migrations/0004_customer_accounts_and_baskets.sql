-- Customer accounts, and a basket that stays one order.
--
-- Three things change here, and they are related: a customer now signs in
-- before ordering, so the same person is the same row every time; one basket
-- becomes one order carrying several breads; and because an order can now hold
-- several breads, a short drop has to say which bread was short.
--
-- Access model, unchanged: every table below has RLS enabled with no
-- anon/authenticated policies. All reads and writes go through server-side
-- code holding the secret key. Functions are closed to public/anon/
-- authenticated and granted only to service_role — decision 0024.

-- ---------------------------------------------------------------------------
-- Customers: the details a person gives when they open an account
-- ---------------------------------------------------------------------------
--
-- `area` already existed and is the short label the owner reads on the round
-- ("East Legon"). `address` is the fuller thing a customer types when they
-- sign up — house, street, landmark — and is what she reads when she needs to
-- actually find them.

alter table customers add column if not exists address text;
alter table customers add column if not exists email text;

-- The owner's own book, filled in so her screen shows the same detail for
-- someone she added by hand as for someone who signed up online.
update customers set address = case id
  when '10000000-0000-4000-8000-000000000001' then 'Baatsonaa Total filling station, Spintex Road'
  when '10000000-0000-4000-8000-000000000002' then 'Adom Provisions, Madina Market, shop 14'
  when '10000000-0000-4000-8000-000000000003' then 'House 12, 4th Norla Street, Labone'
  when '10000000-0000-4000-8000-000000000004' then 'Blue gate opposite the school, Boundary Road, East Legon'
  when '10000000-0000-4000-8000-000000000005' then '3rd floor, Cantonments Road, near the embassy'
end
where address is null
  and id in (
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000005'
  );

-- ---------------------------------------------------------------------------
-- How a customer proves who they are
-- ---------------------------------------------------------------------------
--
-- Phone number plus a PIN they choose, like mobile money. Deliberately its own
-- table rather than columns on `customers`: every admin screen loads whole
-- customer rows, and a secret that is never selected cannot be leaked into a
-- page by accident.
--
-- The PIN is stored as a scrypt hash with a per-customer salt, never in the
-- clear. Hashing happens in the app (node:crypto), so this table holds the
-- result and nothing else.
--
-- NOT the plan in CLAUDE.md, which is Supabase phone OTP. That needs an SMS
-- provider billed per message in Ghana, which is open question AUTH-3. This is
-- the demo-grade stand-in until that is answered — see decision 0027.

create table if not exists customer_credentials (
  customer_id uuid primary key references customers(id) on delete cascade,
  pin_hash text not null,
  pin_salt text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table customer_credentials enable row level security;
-- Deliberately no policies. Only server-side code holding the secret key ever
-- touches this table.

-- ---------------------------------------------------------------------------
-- Orders: where this one goes
-- ---------------------------------------------------------------------------
--
-- A customer's address is where they live. It is not necessarily where they
-- want this bread taken — an order can go to an office, a church, a relative.
-- So the delivery address belongs to the order, not to the person, and the
-- customer's address is only ever the default.

alter table orders add column if not exists delivery_address text;

-- ---------------------------------------------------------------------------
-- Order lines: what actually arrived, per bread
-- ---------------------------------------------------------------------------
--
-- `deliveries.delivered_quantity` holds one number for the whole order. With
-- one bread per order that was exact. Now that a basket is one order, "they
-- took 8 of the 15" cannot say 8 of which bread — and the two breads are
-- rarely the same price, so guessing changes what the customer owes.
--
-- The per-bread number lives here; `deliveries.delivered_quantity` stays as
-- their sum, so every existing count, badge and report keeps working.

alter table order_items
  add column if not exists delivered_quantity integer not null default 0;

-- Which bread came first in the basket.
--
-- Every line of an order is inserted in one statement, so they all share a
-- `created_at` to the microsecond — ordering by it leaves ties, and PostgREST
-- makes no promise about how a tie comes back. The owner would have seen the
-- breads on an order swap places between refreshes.
alter table order_items
  add column if not exists position integer not null default 0;

-- Backfill: reproduce exactly what the old code computed, which filled an
-- order's lines in order until the delivered total ran out. For every order
-- that exists today there is only one line, so this is exact rather than a
-- best effort.
with filled as (
  select
    oi.id,
    least(
      oi.quantity,
      greatest(
        0,
        d.delivered_quantity - coalesce(
          sum(oi.quantity) over (
            partition by oi.order_id
            order by oi.created_at, oi.id
            rows between unbounded preceding and 1 preceding
          ),
          0
        )
      )
    ) as delivered
  from order_items oi
  join deliveries d on d.order_id = oi.order_id
)
update order_items
set delivered_quantity = filled.delivered
from filled
where order_items.id = filled.id
  and order_items.delivered_quantity = 0;

-- Added after the backfill, so the constraint describes rows that already
-- satisfy it. Nobody can be recorded as taking more bread than they ordered.
alter table order_items drop constraint if exists order_items_delivered_quantity_check;
alter table order_items add constraint order_items_delivered_quantity_check
  check (delivered_quantity >= 0 and delivered_quantity <= quantity);

-- ---------------------------------------------------------------------------
-- place_order — now carries the delivery address
-- ---------------------------------------------------------------------------
--
-- Dropped and recreated rather than `create or replace`: a new argument list
-- creates a second function rather than replacing the first, and PostgREST
-- would then have two candidates for one RPC name and refuse to choose.
--
-- Everything else is unchanged. Prices are still resolved and snapshotted by
-- the caller, so the money rule stays in packages/shared and out of SQL. A
-- basket of several breads now arrives as several entries in p_lines and
-- becomes ONE order, which is the whole point of this migration.

-- The old seven-argument version goes; `create or replace` below then handles
-- the new one, so running this migration twice is harmless.
drop function if exists place_order(uuid, date, text, jsonb, text, text, text);

create or replace function place_order(
  p_customer_id uuid,
  p_delivery_date date,
  p_source text,
  p_lines jsonb,
  p_payment_method text default null,
  p_payment_status text default null,
  p_delivery_note text default null,
  p_delivery_address text default null
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
    delivery_note, delivery_address, total_pesewas
  )
  values (
    p_customer_id, p_delivery_date, p_source, p_payment_method, p_payment_status,
    p_delivery_note, p_delivery_address, v_total
  )
  returning id into v_order_id;

  -- `with ordinality` numbers the lines in the order the caller sent them, so
  -- the owner reads the basket the way the customer built it.
  insert into order_items (
    order_id, product_id, product_name, unit_price_pesewas, quantity, position
  )
  select
    v_order_id,
    (line->>'product_id')::uuid,
    line->>'product_name',
    (line->>'unit_price_pesewas')::integer,
    (line->>'quantity')::integer,
    (ord - 1)::integer
  from jsonb_array_elements(p_lines) with ordinality as t(line, ord);

  insert into deliveries (order_id, status, delivered_quantity)
  values (v_order_id, 'pending', 0);

  return v_order_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- record_delivery — the delivery and every bread on it, or neither
-- ---------------------------------------------------------------------------
--
-- Recording a delivery used to be a single-table write, which decision 0021
-- deliberately arranged. Per-bread amounts make it two tables, so it needs a
-- transaction for the same reason place_order does: a failure between the two
-- writes would leave a delivery marked done whose breads still read as
-- undelivered, and the customer's balance would silently disagree with her
-- screen.
--
-- p_lines is [{"order_item_id": uuid, "quantity": int}]. The quantities are
-- decided by resolveDeliveredLines in packages/shared before this is called —
-- this function is a transaction wrapper, not a place where rules live. The
-- check constraint above is the backstop, not the rule.

create or replace function record_delivery(
  p_order_id uuid,
  p_status text,
  p_lines jsonb,
  p_note text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
begin
  if p_status not in ('delivered', 'partial', 'not_delivered') then
    raise exception 'Unknown delivery outcome: %', p_status;
  end if;

  update order_items oi
  set delivered_quantity = (line->>'quantity')::integer
  from jsonb_array_elements(p_lines) as line
  where oi.id = (line->>'order_item_id')::uuid
    and oi.order_id = p_order_id;

  select coalesce(sum(delivered_quantity), 0) into v_total
  from order_items where order_id = p_order_id;

  update deliveries
  set status = p_status,
      delivered_quantity = v_total,
      delivered_at = now(),
      note = p_note
  where order_id = p_order_id;

  if not found then
    raise exception 'Order % has no delivery to record against', p_order_id;
  end if;
end;
$$;

-- Closed to the publishable key, exactly as 0003 established. A security
-- definer function bypasses RLS by design, so execute permission is the only
-- control that matters.
revoke all on function public.place_order(uuid, date, text, jsonb, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.record_delivery(uuid, text, jsonb, text)
  from public, anon, authenticated;

grant execute on function public.place_order(uuid, date, text, jsonb, text, text, text, text)
  to service_role;
grant execute on function public.record_delivery(uuid, text, jsonb, text)
  to service_role;
