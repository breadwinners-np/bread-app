/**
 * The demo itself: a customer orders online, and the owner sees it.
 *
 * This is the one script that needs both apps running, because it reads the
 * owner's actual rendered screens rather than the database. A row existing is
 * not the same as her seeing it.
 *
 *   npm run dev            (admin, port 3000)
 *   npm run dev:storefront (storefront, port 3001)
 *   npm run verify:demo
 */
import { TEST_PREFIX, asServer, check, finish, group, rpcAsServer } from "./lib.mjs";

const ADMIN = "http://localhost:3000";
const NAME = `${TEST_PREFIX} demo loop`;
const TOMORROW = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

const created = { customers: [], orders: [] };

async function screen(pathAndQuery) {
  const response = await fetch(`${ADMIN}/${pathAndQuery}`);
  if (!response.ok) throw new Error(`${pathAndQuery} returned ${response.status}`);
  return response.text();
}

try {
  const reachable = await fetch(ADMIN).then((r) => r.ok).catch(() => false);
  if (!reachable) {
    console.error(`The admin app is not running on ${ADMIN}. Start it with: npm run dev`);
    process.exit(2);
  }

  const customer = (
    await asServer("customers", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        name: NAME,
        phone: "+233 24 000 8822",
        type: "individual",
        area: "Testville",
      }),
    })
  ).body[0];
  created.customers.push(customer.id);

  // A basket of two breads becomes two orders (decision 0023).
  const products = (await asServer("products?select=id,name,price_pesewas&order=name&limit=2")).body;

  for (const product of products) {
    const id = (
      await rpcAsServer("place_order", {
        p_customer_id: customer.id,
        p_delivery_date: TOMORROW,
        p_source: "app",
        p_lines: [
          {
            product_id: product.id,
            product_name: product.name,
            unit_price_pesewas: product.price_pesewas,
            quantity: 2,
          },
        ],
        p_payment_method: "card",
        p_payment_status: "pending",
      })
    ).body;
    created.orders.push(id);
  }

  group("A customer places an order");
  check("a two-bread basket becomes two orders", created.orders.length === 2 && created.orders.every(Boolean));

  const beforePaying = await screen("orders");
  check(
    "an abandoned checkout does not clutter the owner's screen",
    !beforePaying.includes(NAME),
  );

  group("The customer pays");
  for (const id of created.orders) {
    await rpcAsServer("confirm_order_payment", { p_order_id: id, p_reference: "LOOP-REF", p_method: "card" });
  }

  const orders = await screen("orders");
  check("the order appears on the Orders page", orders.includes(NAME));
  check("tagged as an online order", orders.includes("Online"));
  check("and can be cancelled from there", orders.includes("Cancel"));

  group("The rest of her screens agree");
  const customers = await screen("customers");
  check("the customer is now in her Customers list", customers.includes(NAME));

  const round = await screen(`distribution?date=${TOMORROW}`);
  check("the bread is on the round for the day the customer chose", round.includes(NAME));

  const payments = await screen("payments");
  check("the card payment shows on the Payments page", payments.includes(NAME));
  check(
    "gateway money is not sitting in her confirm queue (decision 0022)",
    !new RegExp(`Customer said they paid[\\s\\S]{0,4000}${NAME}`).test(payments),
  );

  group("Cancelling an order");
  const roundBefore = (round.match(new RegExp(NAME, "g")) || []).length;

  await asServer(`orders?id=eq.${created.orders[0]}`, {
    method: "PATCH",
    body: JSON.stringify({ cancelled_at: new Date().toISOString() }),
  });

  const roundAfter = await screen(`distribution?date=${TOMORROW}`);
  const stillListed = (roundAfter.match(new RegExp(NAME, "g")) || []).length;
  check("a cancelled order leaves the delivery round", stillListed < roundBefore, `${roundBefore} -> ${stillListed}`);

  const history = await screen("orders");
  check("but stays in the order history", history.includes(NAME));
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
