import {
  ORDER_STATUS_LABELS,
  formatDate,
  formatGhs,
  relativeDayLabel,
} from "@bread/shared";

import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  PageHeader,
  QuestionForYou,
} from "@/components/ui";
import { listOrders } from "@/services/orders";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const orders = await listOrders();

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle={
          orders.length === 1
            ? "1 order written down"
            : `${orders.length} orders written down`
        }
        action={<ButtonLink href="/orders/new">Write down an order</ButtonLink>}
      />

      {orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="Write down an order and it will appear on the deliveries for that day."
        />
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-stone-100">
            {orders.map((entry) => {
              const dayLabel = relativeDayLabel(entry.order.deliveryDate);

              return (
                <li
                  key={entry.order.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-6 py-4"
                >
                  <div className="min-w-48">
                    <p className="font-medium text-stone-900">
                      {entry.customerName}
                    </p>
                    <p className="text-stone-600">
                      {entry.quantity} × {entry.productName}
                    </p>
                  </div>

                  <div className="min-w-36">
                    <p className="text-stone-800">
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

                  <p className="w-32 text-right font-semibold tabular-nums text-stone-900">
                    {formatGhs(entry.totalPesewas)}
                  </p>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <QuestionForYou>
        <p>
          Every order here is for{" "}
          <strong className="font-semibold text-stone-900">one single day</strong>. Customers like
          Baatsonaa Total agree an amount for the whole month, and there is no
          way to write that down yet.
        </p>
        <p>
          <strong className="font-semibold text-stone-900">
            When a customer agrees an amount for the month, how do you decide
            what goes out each day?
          </strong>{" "}
          Do you split it evenly, or do they tell you how much they want each
          morning? And if the month ends and they took less than they agreed,
          do they still pay for the rest?
        </p>
      </QuestionForYou>
    </>
  );
}
