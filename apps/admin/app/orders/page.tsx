import {
  ORDER_STATUS_LABELS,
  formatDate,
  formatGhs,
  relativeDayLabel,
} from "@bread/shared";

import { BreadLines } from "@/components/bread-lines";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { listOrders } from "@/services/orders";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const orders = await listOrders();

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle={`${orders.length} in total`}
        action={<ButtonLink href="/orders/new">Add an order</ButtonLink>}
      />

      {orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="Add an order and it will appear on the delivery round for that day."
        />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-stone-200">
            {orders.map((entry) => {
              const dayLabel = relativeDayLabel(entry.order.deliveryDate);

              return (
                <li
                  key={entry.order.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-6 py-5"
                >
                  <div className="min-w-64">
                    <p className="text-lg font-semibold text-stone-900">
                      {entry.customerName}
                    </p>
                    <p>
                      <BreadLines lines={entry.lines} />
                    </p>
                  </div>

                  <div className="min-w-36">
                    <p className="font-medium text-stone-800">
                      {formatDate(entry.order.deliveryDate)}
                    </p>
                    {dayLabel && (
                      <p className="text-sm text-stone-500">{dayLabel}</p>
                    )}
                  </div>

                  <Badge
                    tone={
                      entry.order.status === "delivered"
                        ? "good"
                        : entry.order.status === "partially_delivered"
                          ? "warn"
                          : entry.order.status === "cancelled"
                            ? "bad"
                            : "neutral"
                    }
                  >
                    {ORDER_STATUS_LABELS[entry.order.status]}
                  </Badge>

                  <p className="w-28 text-right text-lg font-semibold tabular-nums text-stone-900">
                    {formatGhs(entry.totalPesewas)}
                  </p>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <p className="mt-6 rounded-xl bg-amber-50 px-5 py-4 text-amber-900">
        <strong className="font-semibold">Monthly agreements are missing.</strong>{" "}
        Wholesale customers like Baatsonaa Total agree a quantity for the whole
        month, but how that total becomes daily deliveries is still open (ORD-3),
        so orders here are day-by-day only.
      </p>
    </>
  );
}
