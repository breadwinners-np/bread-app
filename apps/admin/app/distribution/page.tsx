import Link from "next/link";

import {
  DELIVERY_STATUS_LABELS,
  OUTSTANDING_REASON_LABELS,
  addDays,
  deliveryProgress,
  formatDate,
  formatLongDate,
  relativeDayLabel,
  todayIso,
} from "@bread/shared";

import { recordDeliveryAction, rescheduleDeliveryAction } from "@/app/actions";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  PageHeader,
  buttonClass,
  inputClass,
} from "@/components/ui";
import {
  listDeliveriesForDate,
  listOutstandingDeliveries,
} from "@/services/deliveries";

export const dynamic = "force-dynamic";

export default async function DistributionPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string }>;
}) {
  const { date, view } = await searchParams;
  const today = todayIso();
  const activeDate = date ?? today;
  const showOutstanding = view === "outstanding";

  const outstanding = await listOutstandingDeliveries();

  return (
    <>
      <PageHeader
        title="Deliveries"
        subtitle={
          showOutstanding
            ? "Deliveries that failed or were never recorded"
            : `${relativeDayLabel(activeDate, today) ? `${relativeDayLabel(activeDate, today)} — ` : ""}${formatLongDate(activeDate)}`
        }
      />

      <div className="mb-6 flex gap-2 border-b border-stone-200">
        <Tab href="/distribution" active={!showOutstanding}>
          The daily round
        </Tab>
        <Tab href="/distribution?view=outstanding" active={showOutstanding}>
          Needs attention
          {outstanding.length > 0 && (
            <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-sm font-bold text-white">
              {outstanding.length}
            </span>
          )}
        </Tab>
      </div>

      {showOutstanding ? (
        <OutstandingView items={outstanding} today={today} />
      ) : (
        <DayView activeDate={activeDate} today={today} />
      )}
    </>
  );
}

function Tab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={[
        "-mb-px flex items-center border-b-2 px-4 py-3 text-lg font-semibold transition-colors",
        active
          ? "border-amber-600 text-amber-900"
          : "border-transparent text-stone-500 hover:text-stone-800",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

async function DayView({
  activeDate,
  today,
}: {
  activeDate: string;
  today: string;
}) {
  const deliveries = await listDeliveriesForDate(activeDate);
  const progress = deliveryProgress(deliveries.map((item) => item.delivery));

  return (
    <>
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
          {deliveries.map((item) => (
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
                  {item.order.rescheduledFrom && (
                    <p className="mt-1 text-sm font-medium text-amber-800">
                      Moved from {formatDate(item.order.rescheduledFrom)}
                    </p>
                  )}
                </div>

                <Badge tone={deliveryTone(item.delivery.status)}>
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

              <form action={recordDeliveryAction} className="flex flex-wrap gap-3">
                <input type="hidden" name="orderId" value={item.order.id} />
                <input
                  type="hidden"
                  name="orderedQuantity"
                  value={item.orderedQuantity}
                />

                <button
                  type="submit"
                  name="status"
                  value="delivered"
                  className={buttonClass("primary")}
                >
                  Delivered in full
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
              </form>
            </Card>
          ))}
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

function OutstandingView({
  items,
  today,
}: {
  items: Awaited<ReturnType<typeof listOutstandingDeliveries>>;
  today: string;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Nothing outstanding"
        description="Every delivery has been recorded. Failed and missed deliveries show up here."
      />
    );
  }

  return (
    <>
      <div className="space-y-4">
        {items.map((item) => (
          <Card key={item.delivery.id} className="border-l-4 border-l-red-500">
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
                <p className="mt-2 font-medium text-red-700">
                  Due {formatDate(item.order.deliveryDate)} ·{" "}
                  {item.daysLate === 1 ? "1 day ago" : `${item.daysLate} days ago`}
                </p>
                {item.order.rescheduledFrom && (
                  <p className="text-sm font-medium text-amber-800">
                    Already moved once, from{" "}
                    {formatDate(item.order.rescheduledFrom)}
                  </p>
                )}
              </div>

              <Badge tone={item.reason === "failed" ? "bad" : "warn"}>
                {OUTSTANDING_REASON_LABELS[item.reason]}
              </Badge>
            </div>

            {item.delivery.note && (
              <p className="mb-4 rounded-xl bg-stone-50 px-4 py-3 text-stone-600">
                {item.delivery.note}
              </p>
            )}

            <div className="flex flex-wrap items-end gap-6">
              <form
                action={rescheduleDeliveryAction}
                className="flex flex-wrap items-end gap-3"
              >
                <input type="hidden" name="orderId" value={item.order.id} />
                <div>
                  <label
                    htmlFor={`new-date-${item.delivery.id}`}
                    className="mb-2 block text-base font-semibold text-stone-800"
                  >
                    Deliver instead on
                  </label>
                  <input
                    id={`new-date-${item.delivery.id}`}
                    type="date"
                    name="newDate"
                    min={addDays(item.order.deliveryDate, 1)}
                    defaultValue={addDays(today, 1)}
                    className={inputClass}
                  />
                </div>
                <button type="submit" className={buttonClass("primary")}>
                  Reschedule
                </button>
              </form>

              <form action={recordDeliveryAction}>
                <input type="hidden" name="orderId" value={item.order.id} />
                <input
                  type="hidden"
                  name="orderedQuantity"
                  value={item.orderedQuantity}
                />
                <button
                  type="submit"
                  name="status"
                  value="delivered"
                  className={buttonClass("secondary")}
                >
                  It was delivered
                </button>
              </form>
            </div>
          </Card>
        ))}
      </div>

      <p className="mt-8 rounded-xl bg-amber-50 px-5 py-4 text-amber-900">
        <strong className="font-semibold">Two things are still undecided.</strong>{" "}
        Rescheduling moves the order to the new day, so nothing is billed twice —
        but whether an undelivered drop is owed at all is open (DST-7), and part
        deliveries are not listed here because whether the shortfall gets
        redelivered is the same open question. Customers requesting their own new
        date comes with the mobile app.
      </p>
    </>
  );
}

function deliveryTone(status: string) {
  if (status === "delivered") return "good" as const;
  if (status === "partial") return "warn" as const;
  if (status === "not_delivered") return "bad" as const;
  return "neutral" as const;
}
