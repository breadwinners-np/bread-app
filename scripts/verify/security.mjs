/**
 * What a stranger holding the publishable key can do.
 *
 * The publishable key ships inside every browser that loads the storefront, so
 * it is public in the only sense that matters. Everything this script proves it
 * cannot do is a thing the business depends on it not being able to do.
 *
 * Run: npm run verify:security
 */
import {
  TEST_PREFIX,
  asAnon,
  asServer,
  check,
  finish,
  group,
  rpcAsAnon,
  rpcAsServer,
} from "./lib.mjs";

const created = { customers: [], orders: [] };

try {
  // ------------------------------------------------------------------ reads
  group("A stranger can read the menu, and nothing else");

  const menu = await asAnon("products?select=id,name,price_pesewas");
  check(
    "the bread menu is public, as the storefront needs",
    menu.status === 200 && Array.isArray(menu.body) && menu.body.length > 0,
    `${menu.body?.length} breads`,
  );

  for (const table of [
    "customers",
    "orders",
    "order_items",
    "deliveries",
    "payments",
    "costs",
    "purchases",
    "supply_items",
  ]) {
    const result = await asAnon(`${table}?select=*`);
    const blocked =
      result.status === 401 ||
      result.status === 403 ||
      (Array.isArray(result.body) && result.body.length === 0);

    check(
      `a stranger cannot read ${table}`,
      blocked,
      `status ${result.status}${Array.isArray(result.body) ? `, ${result.body.length} rows` : ""}`,
    );
  }

  // ----------------------------------------------------------------- writes
  group("A stranger cannot write anything");

  const insertOrder = await asAnon("orders", {
    method: "POST",
    body: JSON.stringify({ delivery_date: "2030-01-01", source: "app", total_pesewas: 1 }),
  });
  check("cannot insert an order", insertOrder.status >= 400, `status ${insertOrder.status}`);

  const insertCustomer = await asAnon("customers", {
    method: "POST",
    body: JSON.stringify({
      name: `${TEST_PREFIX} intruder`,
      phone: "0000000001",
      type: "individual",
      area: "x",
    }),
  });
  check("cannot insert a customer", insertCustomer.status >= 400, `status ${insertCustomer.status}`);

  const editPrice = await asAnon("products", {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ price_pesewas: 1 }),
  });
  const priceChanged = Array.isArray(editPrice.body) && editPrice.body.length > 0;
  check(
    "cannot change the price of bread",
    editPrice.status >= 400 || !priceChanged,
    `status ${editPrice.status}`,
  );

  // ------------------------------------------------------------------- RPCs
  //
  // REGRESSION GUARD for decision 0024. Postgres grants EXECUTE on a function
  // to PUBLIC by default and PostgREST publishes it, so both of these were
  // callable by a stranger until migration 0003 revoked them. The first one
  // marked an unpaid order as paid and wrote a confirmed payment for money
  // that never arrived.
  group("A stranger cannot drive the money functions (decision 0024)");

  const pending = await asServer("orders?select=id&payment_status=eq.pending&limit=1");
  const realPendingOrder = pending.body?.[0]?.id ?? null;

  // Set one up if none exists, so this tests a live target rather than a miss.
  let scaffoldCustomer = null;
  let target = realPendingOrder;

  if (!target) {
    const product = (await asServer("products?select=id,name,price_pesewas&limit=1")).body[0];
    scaffoldCustomer = (
      await asServer("customers", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          name: `${TEST_PREFIX} rpc target`,
          phone: "+233 24 000 5501",
          type: "individual",
          area: "Testville",
        }),
      })
    ).body[0];
    created.customers.push(scaffoldCustomer.id);

    target = (
      await rpcAsServer("place_order", {
        p_customer_id: scaffoldCustomer.id,
        p_delivery_date: "2030-01-01",
        p_source: "app",
        p_lines: [
          {
            product_id: product.id,
            product_name: product.name,
            unit_price_pesewas: product.price_pesewas,
            quantity: 50,
          },
        ],
        p_payment_method: "card",
        p_payment_status: "pending",
      })
    ).body;
    created.orders.push(target);
  }

  const attemptPay = await rpcAsAnon("confirm_order_payment", {
    p_order_id: target,
    p_reference: "STOLEN-BREAD",
    p_method: "card",
  });
  check(
    "cannot mark an unpaid order as paid",
    attemptPay.status >= 400,
    `status ${attemptPay.status}`,
  );

  const stillUnpaid = await asServer(`orders?id=eq.${target}&select=payment_status`);
  check(
    "and the order really is still unpaid afterwards",
    stillUnpaid.body?.[0]?.payment_status !== "paid",
    `payment_status ${stillUnpaid.body?.[0]?.payment_status}`,
  );

  const noPayment = await asServer(`payments?order_id=eq.${target}&reference=eq.STOLEN-BREAD&select=id`);
  check("and no payment was written", noPayment.body?.length === 0);

  const attemptPlace = await rpcAsAnon("place_order", {
    p_customer_id: scaffoldCustomer?.id ?? "00000000-0000-4000-8000-000000000000",
    p_delivery_date: "2030-01-01",
    p_source: "app",
    p_lines: [
      {
        product_id: "00000000-0000-4000-8000-000000000000",
        product_name: "free bread",
        unit_price_pesewas: 1,
        quantity: 999,
      },
    ],
  });
  check(
    "cannot create orders at a price of its own choosing",
    attemptPlace.status >= 400,
    `status ${attemptPlace.status}`,
  );
} finally {
  group("Cleanup");

  for (const id of created.orders) {
    await asServer(`payments?order_id=eq.${id}`, { method: "DELETE" });
    await asServer(`orders?id=eq.${id}`, { method: "DELETE" });
  }
  for (const id of created.customers) {
    await asServer(`customers?id=eq.${id}`, { method: "DELETE" });
  }

  const leftover = await asServer(`customers?name=like.${encodeURIComponent(`${TEST_PREFIX}*`)}&select=id`);
  check("no test rows left behind", (leftover.body?.length ?? 0) === 0, `${leftover.body?.length} left`);

  finish();
}
