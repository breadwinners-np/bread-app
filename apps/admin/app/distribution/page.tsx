import {
  DELIVERY_STATUS_LABELS,
  addDays,
  deliveryProgress,
  formatLongDate,
  relativeDayLabel,
  todayIso,
} from "@bread/shared";

import { recordDeliveryAction } from "@/app/actions";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  PageHeader,
  buttonClass,
  inputClass,
} from "@/components/ui";
import { listDeliveriesForDate } from "@/services/deliveries";

export default async function DistributionPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const today = todayIso();
  const activeDate = date ?? today;

  const deliveries = await listDeliveriesForDate(activeDate);
  const progress = deliveryProgress(deliveries.map((item) => item.delivery));
  const dayLabel = relativeDayLabel(activeDate, today);

  return (
    <>
      <PageHeader
        title="Deliveries"
        subtitle={`${dayLabel ? `${dayLabel} — ` : ""}${formatLongDate(activeDate)}`}
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <ButtonLink
          href={`/distribution?date=${addDays(activeDate, -1)}`}
          variant="secondary"
        >
          ← Previous day
        </ButtonLink>
        {activeDate !== today && (
          <ButtonLink href="/distribution" variant="quiet">
            Back to today
          </ButtonLink>
        )}
        <ButtonLink
          href={`/distribution?date=${addDays(activeDate, 1)}`}
          variant="secondary"
        >
          Next day →
        </ButtonLink>

        <p className="ml-auto text-lg font-semibold text-stone-700">
          {progress.done} of {progress.total} done
        </p>
      </div>

      {deliveries.length === 0 ? (
        <EmptyState
          title="No deliveries for this day"
          description="Add an order for this date and it will show up here."
        />
      ) : (
        <div className="space-y-4">
          {deliveries.map((item) => {
            const recorded = item.delivery.status !== "pending";

            return (
              <Card key={item.delivery.id}>
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xl font-bold text-stone-900">
                      {item.customer.name}
                    </p>
                    <p className="text-lg text-stone-600">
                      {item.orderedQuantity} × {item.productName}
                    </p>
                    <p className="text-stone-500">
                      {item.customer.area} · {item.customer.phone}
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
                      ? `${DELIVERY_STATUS_LABELS.partial} — ${item.delivery.deliveredQuantity} of ${item.orderedQuantity}`
                      : DELIVERY_STATUS_LABELS[item.delivery.status]}
                  </Badge>
                </div>

                {item.delivery.note && (
                  <p className="mb-4 rounded-xl bg-stone-50 px-4 py-3 text-stone-600">
                    {item.delivery.note}
                  </p>
                )}

                <form action={recordDeliveryAction} className="space-y-4">
                  <input type="hidden" name="orderId" value={item.order.id} />
                  <input
                    type="hidden"
                    name="orderedQuantity"
                    value={item.orderedQuantity}
                  />

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      name="status"
                      value="delivered"
                      className={buttonClass("primary")}
                    >
                      {recorded ? "Mark delivered in full" : "Delivered in full"}
                    </button>

                    <div className="flex items-center gap-2">
                      <label htmlFor={`qty-${item.delivery.id}`} className="sr-only">
                        Quantity delivered to {item.customer.name}
                      </label>
                      <input
                        id={`qty-${item.delivery.id}`}
                        type="number"
                        name="deliveredQuantity"
                        min={0}
                        max={item.orderedQuantity}
                        defaultValue={item.orderedQuantity}
                        className={`${inputClass} w-28`}
                      />
                      <button
                        type="submit"
                        name="status"
                        value="partial"
                        className={buttonClass("secondary")}
                      >
                        Part delivered
                      </button>
                    </div>

                    <button
                      type="submit"
                      name="status"
                      value="not_delivered"
                      className={buttonClass("quiet")}
                    >
                      Could not deliver
                    </button>
                  </div>
                </form>
              </Card>
            );
          })}
        </div>
      )}

      <p className="mt-8 rounded-xl bg-amber-50 px-5 py-4 text-amber-900">
        <strong className="font-semibold">Not built yet:</strong> this round runs
        on the laptop only. Recording deliveries on the road, offline, is the
        mobile app&apos;s job — and which device the driver carries is still an
        open question (DST-6).
      </p>
    </>
  );
}
