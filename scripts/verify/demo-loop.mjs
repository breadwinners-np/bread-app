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

  // A basket of two breads is ONE order with two lines (decision 0026).
  const products = (await asServer("products?select=id,name,price_pesewas&order=name&limit=2")).body;

  const orderId = (
    await rpcAsServer("place_order", {
      p_customer_id: customer.id,
      p_delivery_date: TOMORROW,
      p_source: "app",
      p_lines: products.map((product) => ({
        product_id: product.id,
        product_name: product.name,
        unit_price_pesewas: product.price_pesewas,
        quantity: 2,
      })),
      p_payment_method: "card",
      p_payment_status: "pending",
      p_delivery_address: "12 Test Street, Testville",
    })
  ).body;
  created.orders.push(orderId);

  group("A customer places an order");

  const written = (
    await asServer(`orders?id=eq.${orderId}&select=delivery_address,order_items(product_name,position)`)
  ).body[0];

  check("a two-bread basket is one order", created.orders.length === 1 && Boolean(orderId));
  check("carrying both breads", (written?.order_items?.length ?? 0) === 2);
  check(
    "in the order the customer chose them",
    [...(written?.order_items ?? [])].sort((a, b) => a.position - b.position)
      .map((item) => item.product_name)
      .join(" | ") === products.map((product) => product.name).join(" | "),
  );
  check(
    "going where the customer asked, not to their own address",
    written?.delivery_address === "12 Test Street, Testville",
  );

  const beforePaying = await screen("orders");
  check(
    "an abandoned checkout does not clutter the owner's screen",
    !beforePaying.includes(NAME),
  );

  group("The customer pays");
  await rpcAsServer("confirm_order_payment", {
    p_order_id: orderId,
    p_reference: "LOOP-REF",
    p_method: "card",
  });

  const orders = await screen("orders");
  check("the order appears on the Orders page", orders.includes(NAME));
  check(
    "the customer is named once, not once per bread",
    (orders.match(new RegExp(NAME, "g")) || []).length === 1,
  );
  check(
    "with both breads listed under them",
    products.every((product) => orders.includes(product.name)),
  );
  check("tagged as an online order", orders.includes("Online"));
  check("and can be cancelled from there", orders.includes("Cancel"));

  group("The rest of her screens agree");
  const customers = await screen("customers");
  check("the customer is now in her Customers list", customers.includes(NAME));

  const round = await screen(`distribution?date=${TOMORROW}`);
  check("the bread is on the round for the day the customer chose", round.includes(NAME));
  check("as one drop, with the address the customer gave", round.includes("12 Test Street, Testville"));

  const payments = await screen("payments");
  check("the card payment shows on the Payments page", payments.includes(NAME));
  check(
    "gateway money is not sitting in her confirm queue (decision 0022)",
    !new RegExp(`Customer said they paid[\\s\\S]{0,4000}${NAME}`).test(payments),
  );

  group("Cancelling an order");
  const roundBefore = (round.match(new RegExp(NAME, "g")) || []).length;

  await asServer(`orders?id=eq.${orderId}`, {
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
