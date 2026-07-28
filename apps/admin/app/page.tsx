import Link from "next/link";

import {
  DELIVERY_STATUS_LABELS,
  deliveryProgress,
  formatGhs,
  formatLongDate,
  ordersTotalPesewas,
  todayIso,
} from "@bread/shared";

import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  PageHeader,
  SectionTitle,
  StatTile,
} from "@/components/ui";
import { totalCostsForDate } from "@/services/costs";
import {
  listDeliveriesForDate,
  listOutstandingDeliveries,
} from "@/services/deliveries";
import { listOrdersForDate } from "@/services/orders";
import { listPaymentsAwaitingConfirmation } from "@/services/payments";

// Reads mutable data and "today", so it must never be prerendered at build time.
export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const today = todayIso();

  const [orders, deliveries, costsToday, outstanding, pendingPayments] =
    await Promise.all([
      listOrdersForDate(today),
      listDeliveriesForDate(today),
      totalCostsForDate(today),
      listOutstandingDeliveries(),
      listPaymentsAwaitingConfirmation(),
    ]);

  const loavesToday = orders.reduce((total, entry) => total + entry.quantity, 0);
  const revenueToday = ordersTotalPesewas(orders.map((entry) => entry.order));
  const progress = deliveryProgress(deliveries.map((item) => item.delivery));
  const remaining = progress.total - progress.done;

  return (
    <>
      <PageHeader
        title="Today"
        subtitle={formatLongDate(today)}
        action={<ButtonLink href="/distribution">Start deliveries</ButtonLink>}
      />

      {outstanding.length > 0 && (
        <Link
          href="/distribution?view=outstanding"
          className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-l-4 border-l-red-500 bg-red-50 px-6 py-5 hover:bg-red-100"
        >
          <div>
            <p className="text-lg font-bold text-red-900">
              {outstanding.length}{" "}
              {outstanding.length === 1 ? "delivery needs" : "deliveries need"}{" "}
              attention
            </p>
            <p className="text-red-800">
              Could not be delivered, or the day passed without being recorded.
            </p>
          </div>
          <span className="font-semibold text-red-900">Sort them out →</span>
        </Link>
      )}

      {pendingPayments.length > 0 && (
        <Link
          href="/payments"
          className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-l-4 border-l-amber-500 bg-amber-50 px-6 py-5 hover:bg-amber-100"
        >
          <div>
            <p className="text-lg font-bold text-amber-900">
              {pendingPayments.length === 1
                ? "1 customer says they have paid"
                : `${pendingPayments.length} customers say they have paid`}
            </p>
            <p className="text-amber-800">
              It does not count against what they owe until you confirm it.
            </p>
          </div>
          <span className="font-semibold text-amber-900">Have a look →</span>
        </Link>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Bread to deliver"
          value={String(loavesToday)}
          hint={`across ${orders.length} ${orders.length === 1 ? "order" : "orders"}`}
        />
        <StatTile
          label="Deliveries done"
          value={`${progress.done} of ${progress.total}`}
          hint={remaining > 0 ? `${remaining} still to go` : "All done"}
        />
        <StatTile
          label="Value of today's bread"
          value={formatGhs(revenueToday)}
        />
        <StatTile label="Costs recorded today" value={formatGhs(costsToday)} />
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <SectionTitle>Today&apos;s deliveries</SectionTitle>
          <ButtonLink href="/distribution" variant="secondary">
            Open the round
          </ButtonLink>
        </div>

        {deliveries.length === 0 ? (
          <EmptyState
            title="Nothing to deliver today"
            description="Orders you add for today will appear here."
          />
        ) : (
          <ul className="divide-y divide-stone-200">
            {deliveries.map((item) => (
              <li
                key={item.delivery.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div>
                  <p className="text-lg font-semibold text-stone-900">
                    {item.customer.name}
                  </p>
                  <p className="text-stone-500">
                    {item.orderedQuantity} × {item.productName} ·{" "}
                    {item.customer.area}
                  </p>
                </div>

                <Badge
                  tone={
                    item.delivery.status === "delivered"
                      ? "good"
                      : item.delivery.status === "partial"
                        ? "warn"
                        : item.delivery.status === "not_delivered"
                          ? "bad"
                          : "neutral"
                  }
                >
                  {item.delivery.status === "partial"
                    ? `${DELIVERY_STATUS_LABELS.partial} (${item.delivery.deliveredQuantity})`
                    : DELIVERY_STATUS_LABELS[item.delivery.status]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <ButtonLink href="/orders/new" variant="secondary">
          Add an order
        </ButtonLink>
        <ButtonLink href="/customers/new" variant="secondary">
          Add a customer
        </ButtonLink>
        <ButtonLink href="/customers" variant="secondary">
          Who owes money
        </ButtonLink>
      </div>
    </>
  );
}
