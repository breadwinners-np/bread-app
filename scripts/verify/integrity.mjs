/**
 * What the database itself refuses, and what it guarantees.
 *
 * These are the rules that must hold even when the application code is wrong:
 * transaction boundaries, money arithmetic, the price snapshot, and the
 * constraints that stop impossible rows being written at all.
 *
 * Run: npm run verify:integrity
 */
import {
  TEST_PREFIX,
  asServer,
  check,
  finish,
  group,
  rpcAsServer,
} from "./lib.mjs";

const created = { customers: [], orders: [] };

const TOMORROW = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

try {
  const product = (await asServer("products?select=id,name,price_pesewas&slug=eq.butter-bread")).body[0];

  const customer = (
    await asServer("customers", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        name: `${TEST_PREFIX} integrity`,
        phone: "+233 24 000 7733",
        type: "individual",
        area: "Testville",
      }),
    })
  ).body[0];
  created.customers.push(customer.id);

  // ------------------------------------------------------- place_order
  group("Placing an order is all-or-nothing");

  const orderId = (
    await rpcAsServer("place_order", {
      p_customer_id: customer.id,
      p_delivery_date: TOMORROW,
      p_source: "app",
      p_lines: [
        {
          product_id: product.id,
          product_name: product.name,
          unit_price_pesewas: product.price_pesewas,
          quantity: 4,
        },
      ],
      p_payment_method: "card",
      p_payment_status: "pending",
      p_delivery_note: "verification run",
    })
  ).body;
  created.orders.push(orderId);

  check("an order id comes back", !!orderId);

  const order = (
    await asServer(
      `orders?id=eq.${orderId}&select=total_pesewas,delivery_date,source,order_items(quantity,unit_price_pesewas),deliveries(status,delivered_quantity)`,
    )
  ).body[0];

  check(
    "the total is computed from the lines, not taken from the caller",
    order.total_pesewas === product.price_pesewas * 4,
    `${order.total_pesewas}`,
  );
  check("the order line is written", order.order_items?.length === 1);

  // order_id is UNIQUE on deliveries, so PostgREST embeds it as one object.
  const delivery = Array.isArray(order.deliveries) ? order.deliveries[0] : order.deliveries;
  check(
    "a delivery record is created in the same transaction",
    !!delivery && delivery.status === "pending" && delivery.delivered_quantity === 0,
  );
  check("the delivery day is the one the customer chose", order.delivery_date === TOMORROW);

  const emptyBasket = await rpcAsServer("place_order", {
    p_customer_id: customer.id,
    p_delivery_date: TOMORROW,
    p_source: "app",
    p_lines: [],
  });
  check("an order with no bread in it is refused", emptyBasket.status >= 400, `status ${emptyBasket.status}`);

  const ghostProduct = await rpcAsServer("place_order", {
    p_customer_id: customer.id,
    p_delivery_date: TOMORROW,
    p_source: "app",
    p_lines: [
      {
        product_id: "00000000-0000-4000-8000-000000000000",
        product_name: "ghost",
        unit_price_pesewas: 100,
        quantity: 1,
      },
    ],
  });
  check("an order for bread that does not exist is refused", ghostProduct.status >= 400, `status ${ghostProduct.status}`);

  // -------------------------------------------------- price snapshotting
  group("A price change never rewrites a past order");

  const before = (await asServer(`orders?id=eq.${orderId}&select=total_pesewas,order_items(unit_price_pesewas)`)).body[0];

  await asServer(`products?id=eq.${product.id}`, {
    method: "PATCH",
    body: JSON.stringify({ price_pesewas: product.price_pesewas + 500 }),
  });

  const after = (await asServer(`orders?id=eq.${orderId}&select=total_pesewas,order_items(unit_price_pesewas)`)).body[0];

  await asServer(`products?id=eq.${product.id}`, {
    method: "PATCH",
    body: JSON.stringify({ price_pesewas: product.price_pesewas }),
  });

  check("the order total is unchanged by a price rise", before.total_pesewas === after.total_pesewas);
  check(
    "the snapshotted line price is unchanged",
    before.order_items[0].unit_price_pesewas === after.order_items[0].unit_price_pesewas,
  );

  // ------------------------------------------------ confirm_order_payment
  group("Money is recorded once, and only once");

  const first = await rpcAsServer("confirm_order_payment", {
    p_order_id: orderId,
    p_reference: "VERIFY-REF-1",
    p_method: "card",
  });
  check("the first payment goes through", !!first.body);

  const second = await rpcAsServer("confirm_order_payment", {
    p_order_id: orderId,
    p_reference: "VERIFY-REF-2",
    p_method: "card",
  });
  check("a repeated payment is refused, so a double click cannot charge twice", second.body === null);

  const payments = (await asServer(`payments?order_id=eq.${orderId}&select=amount_pesewas,confirmed_at,source`)).body;
  check("exactly one payment exists", payments.length === 1, `${payments.length}`);
  check("it is worth exactly what the order was", payments[0].amount_pesewas === product.price_pesewas * 4);
  check("gateway money is confirmed on arrival (decision 0022)", !!payments[0].confirmed_at);
  check("and is recorded as coming from the app", payments[0].source === "app");

  const ghostOrder = await rpcAsServer("confirm_order_payment", {
    p_order_id: "00000000-0000-4000-8000-000000000000",
    p_reference: "VERIFY",
    p_method: "card",
  });
  check(
    "paying an order that does not exist returns nothing rather than erroring",
    ghostOrder.status === 200 && ghostOrder.body === null,
  );

  // ------------------------------------------------------- constraints
  group("The database refuses impossible data");

  const cases = [
    ["a line of zero loaves", "order_items", { order_id: orderId, product_id: product.id, product_name: "x", unit_price_pesewas: 100, quantity: 0 }],
    ["a negative quantity", "order_items", { order_id: orderId, product_id: product.id, product_name: "x", unit_price_pesewas: 100, quantity: -5 }],
    ["a negative price", "order_items", { order_id: orderId, product_id: product.id, product_name: "x", unit_price_pesewas: -100, quantity: 1 }],
    ["a line on an order that does not exist", "order_items", { order_id: "00000000-0000-4000-8000-000000000000", product_id: product.id, product_name: "x", unit_price_pesewas: 100, quantity: 1 }],
    ["a payment of nothing", "payments", { customer_id: null, amount_pesewas: 0, method: "cash", source: "admin" }],
    ["an invented payment method", "payments", { customer_id: null, amount_pesewas: 100, method: "bitcoin", source: "admin" }],
    ["an invented order source", "orders", { delivery_date: TOMORROW, source: "carrier-pigeon" }],
    ["an invented delivery status", "deliveries", { order_id: orderId, status: "maybe", delivered_quantity: 0 }],
    ["a second delivery for one order", "deliveries", { order_id: orderId, status: "pending", delivered_quantity: 0 }],
    ["an invented customer type", "customers", { name: `${TEST_PREFIX} bad`, phone: "0240009998", type: "royalty", area: "x" }],
  ];

  for (const [label, table, row] of cases) {
    const payload = { ...row };
    if ("customer_id" in payload && payload.customer_id === null) payload.customer_id = customer.id;
    const result = await asServer(table, { method: "POST", body: JSON.stringify(payload) });
    check(`${label} is refused`, result.status >= 400, `status ${result.status}`);
  }

  const negativeDelivered = await asServer(`deliveries?order_id=eq.${orderId}`, {
    method: "PATCH",
    body: JSON.stringify({ delivered_quantity: -1 }),
  });
  check("a negative delivered quantity is refused", negativeDelivered.status >= 400, `status ${negativeDelivered.status}`);

  // ---------------------------------------------------------- customers
  group("One phone number is one customer");

  const duplicate = await asServer("customers", {
    method: "POST",
    body: JSON.stringify({
      name: `${TEST_PREFIX} impostor`,
      phone: "0240007733", // the same number, written locally
      type: "individual",
      area: "elsewhere",
    }),
  });
  check("the same number written differently cannot create a second customer", duplicate.status === 409, `status ${duplicate.status}`);

  const unchanged = (await asServer(`customers?id=eq.${customer.id}&select=name,area`)).body[0];
  check("a checkout cannot rename an existing customer", unchanged.name === `${TEST_PREFIX} integrity`);
  check("nor move their delivery area", unchanged.area === "Testville");

  const deleteBusy = await asServer(`customers?id=eq.${customer.id}`, { method: "DELETE" });
  check("a customer with orders cannot be deleted outright", deleteBusy.status >= 400, `status ${deleteBusy.status}`);

  // ------------------------------------------------------------ cascade
  group("Deleting an order cleans up after itself");

  await asServer(`payments?order_id=eq.${orderId}`, { method: "DELETE" });
  await asServer(`orders?id=eq.${orderId}`, { method: "DELETE" });
  created.orders = created.orders.filter((id) => id !== orderId);

  const orphanItems = (await asServer(`order_items?order_id=eq.${orderId}&select=id`)).body;
  const orphanDelivery = (await asServer(`deliveries?order_id=eq.${orderId}&select=id`)).body;
  check("its lines go with it", orphanItems.length === 0);
  check("its delivery goes with it", orphanDelivery.length === 0);
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
