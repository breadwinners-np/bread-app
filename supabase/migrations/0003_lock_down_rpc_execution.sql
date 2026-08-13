-- Close the two money functions to the public.
--
-- THE HOLE THIS FIXES, found by testing with the publishable key:
--
--   Postgres grants EXECUTE on a new function to PUBLIC by default, and
--   PostgREST publishes every function in the `public` schema as an RPC
--   endpoint that the anon key can reach. Both functions in 0002 are
--   `security definer`, so they ran as their owner — straight past the row
--   level security that is otherwise the only thing protecting these tables.
--
--   Anyone with the publishable key, which ships inside every browser that
--   loads the storefront, could:
--
--     POST /rest/v1/rpc/confirm_order_payment  -> mark any unpaid order paid
--                                                 and write a confirmed
--                                                 payment for money that
--                                                 never arrived
--     POST /rest/v1/rpc/place_order            -> create orders directly,
--                                                 at any price they chose,
--                                                 skipping the server action
--                                                 that resolves real prices
--
--   The first is the serious one: the owner's screen would show the order as
--   paid, and she would bake and deliver against it.
--
-- Both functions are only ever called from server-side code holding the
-- secret key (apps/storefront/app/actions.ts, apps/admin/app/actions.ts), so
-- nothing legitimate loses access here.
--
-- RLS alone could not have prevented this: `security definer` exists
-- precisely to bypass it. Execute permission is the control that matters for
-- a function, and it has to be revoked explicitly.

revoke all on function public.place_order(uuid, date, text, jsonb, text, text, text)
  from public, anon, authenticated;

revoke all on function public.confirm_order_payment(uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.place_order(uuid, date, text, jsonb, text, text, text)
  to service_role;

grant execute on function public.confirm_order_payment(uuid, text, text)
  to service_role;

-- Any function added to this schema later starts closed rather than open, so
-- the same mistake cannot be made silently by the next migration.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
