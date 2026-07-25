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
import { listDeliveriesForDate } from "@/services/deliveries";
import { listOrdersForDate } from "@/services/orders";

// Reads mutable data and "today", so it must never be prerendered at build time.
export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const today = todayIso();

  const [orders, deliveries, costsToday] = await Promise.all([
    listOrdersForDate(today),
    listDeliveriesForDate(today),
    totalCostsForDate(today),
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
