import Link from "next/link";
import { notFound } from "next/navigation";

import { formatDate, formatGhs } from "@bread/shared";

import { supabaseAdmin } from "@/lib/supabase-admin";

// A dynamic segment with no generateStaticParams caches indefinitely, so a
// customer would keep seeing the order exactly as it looked when the page was
// first rendered.
export const dynamic = "force-dynamic";

interface OrderRow {
  id: string;
  delivery_date: string;
  delivery_note: string | null;
  payment_method: "card" | "mobile_money" | "cash" | "cheque" | null;
  payment_status: "pending" | "paid" | "failed" | null;
  payment_reference: string | null;
  total_pesewas: number | null;
  customers: { name: string; phone: string } | null;
  order_items: {
    id: string;
    product_name: string;
    unit_price_pesewas: number;
    quantity: number;
  }[];
}

const ORDER_SELECT =
  "id, delivery_date, delivery_note, payment_method, payment_status, payment_reference, total_pesewas, customers(name, phone), order_items(id, product_name, unit_price_pesewas, quantity)";

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // The order id is an unguessable UUID acting as the access token for this
  // page — there is no customer login yet to check ownership against. Fine for
  // a link the customer just followed themselves; a production version should
  // scope this to an authenticated customer, per CLAUDE.md's phone-OTP plan.
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", id)
    .maybeSingle<OrderRow>();

  if (!order) {
    notFound();
  }

  // A basket with several breads becomes one order per bread, all paid in one
  // go and sharing a payment reference. Show the whole basket, not one bread.
  let orders: OrderRow[] = [order];
  if (order.payment_reference) {
    const { data: siblings } = await supabaseAdmin
      .from("orders")
      .select(ORDER_SELECT)
      .eq("payment_reference", order.payment_reference)
      .order("id")
      .returns<OrderRow[]>();

    if (siblings && siblings.length > 0) orders = siblings;
  }

  const customer = order.customers;
  const paid = order.payment_status === "paid";
  const items = orders.flatMap((entry) => entry.order_items ?? []);
  const total = items.reduce(
    (sum, item) => sum + item.unit_price_pesewas * item.quantity,
    0,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">
          {paid ? "Order confirmed" : "Order received"}
        </h1>
        <p className="mt-1 text-stone-600">
          Thanks{customer ? `, ${customer.name}` : ""}. We&rsquo;ll bring it on{" "}
          {formatDate(order.delivery_date)}
          {customer ? ` and call you on ${customer.phone}` : ""}.
        </p>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-6">
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-stone-500">Delivery day</dt>
          <dd className="text-right text-stone-900">{formatDate(order.delivery_date)}</dd>
          <dt className="text-stone-500">Payment</dt>
          <dd className="text-right capitalize text-stone-900">
            {order.payment_status ?? "pending"}
          </dd>
          <dt className="text-stone-500">Method</dt>
          <dd className="text-right text-stone-900">
            {order.payment_method === "card" ? "Card" : "Mobile money"}
          </dd>
          {order.delivery_note ? (
            <>
              <dt className="text-stone-500">Note</dt>
              <dd className="text-right text-stone-900">{order.delivery_note}</dd>
            </>
          ) : null}
        </dl>

        <div className="mt-4 space-y-2 border-t border-stone-200 pt-4">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-stone-700">
                {item.quantity} × {item.product_name}
              </span>
              <span className="text-stone-900">
                {formatGhs(item.unit_price_pesewas * item.quantity)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-between border-t border-stone-200 pt-4 text-lg font-semibold text-stone-900">
          <span>Total</span>
          <span>{formatGhs(total)}</span>
        </div>
      </div>

      <Link href="/" className="inline-block text-amber-800 underline">
        Order more bread
      </Link>
    </div>
  );
}
