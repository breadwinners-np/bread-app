import Link from "next/link";

import {
  CUSTOMER_TYPE_LABELS,
  DELIVERY_STATUS_LABELS,
  formatDate,
  formatGhs,
} from "@bread/shared";

import { AccountForms } from "@/components/account-forms";
import { getCustomerById, listOrdersForCustomer } from "@/lib/account";
import { getSessionCustomerId } from "@/lib/session";
import { signOutAction } from "./actions";

// Reads the session cookie, so it can never be prerendered and cached.
export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const customerId = await getSessionCustomerId();

  if (!customerId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Your account</h1>
          <p className="mt-1 text-stone-600">
            Sign in to order, or open an account — it takes a minute.
          </p>
        </div>
        <AccountForms next={next ?? "/account"} />
      </div>
    );
  }

  const customer = await getCustomerById(customerId);

  // The cookie is signed, so this only happens if the owner archived and
  // removed them. Treat it as signed out rather than crashing.
  if (!customer) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-stone-900">Your account</h1>
        <AccountForms next="/account" />
      </div>
    );
  }

  const orders = await listOrdersForCustomer(customerId);
  const loaves = orders.reduce(
    (total, entry) =>
      total + entry.order.lines.reduce((sum, line) => sum + line.quantity, 0),
    0,
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">{customer.name}</h1>
          <p className="mt-1 text-stone-600">
            {CUSTOMER_TYPE_LABELS[customer.type]} · {customer.phone}
          </p>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700"
          >
            Sign out
          </button>
        </form>
      </div>

      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-stone-900">Your details</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <Detail label="Area" value={customer.area} />
          <Detail label="Address" value={customer.address ?? "Not given"} />
          {customer.email ? <Detail label="Email" value={customer.email} /> : null}
        </dl>
        <p className="mt-4 text-sm text-stone-500">
          Your address is where you live. You can send any order somewhere else
          when you check out.
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-stone-900">Your orders</h2>
          {orders.length > 0 && (
            <p className="text-sm text-stone-500">
              {orders.length} {orders.length === 1 ? "order" : "orders"} ·{" "}
              {loaves} {loaves === 1 ? "loaf" : "loaves"}
            </p>
          )}
        </div>

        {orders.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-stone-300 px-6 py-10 text-center text-stone-600">
            Nothing yet.{" "}
            <Link href="/" className="text-amber-800 underline">
              Have a look at today&rsquo;s bread
            </Link>
            .
          </p>
        ) : (
          <ul className="space-y-3">
            {orders.map((entry) => (
              <li
                key={entry.order.id}
                className="rounded-2xl border border-stone-200 bg-white p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-stone-900">
                      {formatDate(entry.order.deliveryDate)}
                    </p>
                    <p className="text-sm text-stone-500">
                      {DELIVERY_STATUS_LABELS[entry.deliveryStatus]}
                      {entry.paid ? " · Paid" : " · Not paid"}
                    </p>
                  </div>
                  <p className="font-semibold tabular-nums text-stone-900">
                    {formatGhs(entry.totalPesewas)}
                  </p>
                </div>

                {/*
                  Every bread on the order, under the one date. One basket is
                  one order, so this is where a customer sees the whole basket
                  rather than the same day repeated once per bread.
                */}
                <ul className="mt-3 space-y-1 border-t border-stone-100 pt-3 text-sm">
                  {entry.order.lines.map((lineItem) => (
                    <li key={lineItem.id} className="flex justify-between">
                      <span className="text-stone-700">
                        {lineItem.quantity} × {lineItem.productName}
                      </span>
                      <span className="tabular-nums text-stone-500">
                        {formatGhs(lineItem.quantity * lineItem.unitPricePesewas)}
                      </span>
                    </li>
                  ))}
                </ul>

                {entry.order.deliveryAddress && (
                  <p className="mt-3 text-sm text-stone-500">
                    Delivered to {entry.order.deliveryAddress}
                  </p>
                )}

                <Link
                  href={`/order/${entry.order.id}`}
                  className="mt-3 inline-block text-sm text-amber-800 underline"
                >
                  See this order
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6">
      <dt className="text-stone-500">{label}</dt>
      <dd className="text-right text-stone-900">{value}</dd>
    </div>
  );
}
