import {
  DELIVERY_STATUS_LABELS,
  describeOrderLines,
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
  NoticeLink,
  PageHeader,
  SectionTitle,
  StatRow,
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
        action={<ButtonLink href="/distribution">Start the deliveries</ButtonLink>}
      />

      {/*
        Anything wrong comes before anything merely informative, so the first
        thing she reads is the thing that needs her.
      */}
      {(outstanding.length > 0 || pendingPayments.length > 0) && (
        <div className="mb-10">
          {outstanding.length > 0 && (
            <NoticeLink
              href="/distribution?view=outstanding"
              tone="urgent"
              title={
                outstanding.length === 1
                  ? "1 delivery did not get there"
                  : `${outstanding.length} deliveries did not get there`
              }
              description="The bread could not be delivered, or nobody said what happened."
              actionLabel="Sort them out"
            />
          )}

          {pendingPayments.length > 0 && (
            <NoticeLink
              href="/payments"
              tone="attention"
              title={
                pendingPayments.length === 1
                  ? "1 customer says they have paid you"
                  : `${pendingPayments.length} customers say they have paid you`
              }
              description="It does not count against what they owe until you say it arrived."
              actionLabel="Check them"
            />
          )}
        </div>
      )}

      <StatRow>
        <StatTile
          label="Bread to deliver"
          value={String(loavesToday)}
          hint={`for ${orders.length} ${orders.length === 1 ? "customer" : "customers"}`}
        />
        <StatTile
          label="Deliveries done"
          value={`${progress.done} of ${progress.total}`}
          hint={remaining > 0 ? `${remaining} still to go` : "All done"}
        />
        <StatTile
          label="Today's bread is worth"
          value={formatGhs(revenueToday)}
          hint="If it all gets delivered"
        />
        <StatTile
          label="Spent today"
          value={formatGhs(costsToday)}
          hint="Flour, gas, transport"
        />
      </StatRow>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SectionTitle>Who is getting bread today</SectionTitle>
        <ButtonLink href="/distribution" variant="secondary">
          Open the round
        </ButtonLink>
      </div>

      {deliveries.length === 0 ? (
        <EmptyState
          title="Nobody is expecting bread today"
          description="Orders you add for today will show up here."
        />
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-stone-100">
            {deliveries.map((item) => (
              <li
                key={item.delivery.id}
                className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
              >
                <div>
                  <p className="font-medium text-stone-900">
                    {item.customer.name}
                  </p>
                  <p className="text-stone-600">
                    {describeOrderLines(item.order)}
                  </p>
                  <p className="text-sm text-stone-500">
                    {item.order.deliveryAddress || item.customer.area}
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
        </Card>
      )}

      <div className="mt-12 border-t border-stone-200 pt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Other things you might do
        </h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <ButtonLink href="/orders/new" variant="secondary">
            Write down an order
          </ButtonLink>
          <ButtonLink href="/payments/new" variant="secondary">
            Write down a payment
          </ButtonLink>
          <ButtonLink href="/customers" variant="secondary">
            See who owes you
          </ButtonLink>
        </div>
      </div>
    </>
  );
}
