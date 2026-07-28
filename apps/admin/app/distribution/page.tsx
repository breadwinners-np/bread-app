import Link from "next/link";

import {
  DELIVERY_STATUS_LABELS,
  OUTSTANDING_REASON_LABELS,
  addDays,
  deliveryProgress,
  formatDate,
  formatLongDate,
  isValidIsoDate,
  relativeDayLabel,
  todayIso,
} from "@bread/shared";

import { recordDeliveryAction, rescheduleDeliveryAction } from "@/app/actions";
import { ConfirmButton, GuardedSubmit } from "@/components/confirm-button";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  HowThisWorks,
  PageHeader,
  QuestionForYou,
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
  // A typed or stale ?date= is not trusted: anything that is not a real day
  // falls back to today, so a bad link shows her the round rather than an error.
  const activeDate = date && isValidIsoDate(date) ? date : today;
  const showOutstanding = view === "outstanding";

  const outstanding = await listOutstandingDeliveries();

  return (
    <>
      <PageHeader
        title="Deliveries"
        subtitle={
          showOutstanding
            ? "Bread that never reached the customer"
            : `${relativeDayLabel(activeDate, today) ? `${relativeDayLabel(activeDate, today)} — ` : ""}${formatLongDate(activeDate)}`
        }
      />

      <div className="mb-8 flex flex-wrap gap-6 border-b border-stone-200">
        <Tab href="/distribution" active={!showOutstanding}>
          The day&apos;s round
        </Tab>
        <Tab href="/distribution?view=outstanding" active={showOutstanding}>
          Needs sorting out
          {outstanding.length > 0 && (
            <span className="ml-2 rounded-md bg-red-50 px-2 py-0.5 text-sm font-medium text-red-800">
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
      aria-current={active ? "page" : undefined}
      className={[
        "-mb-px flex items-center border-b-2 pb-3 font-medium transition-colors",
        active
          ? "border-stone-900 text-stone-900"
          : "border-transparent text-stone-500 hover:text-stone-900",
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
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <ButtonLink
          href={`/distribution?date=${addDays(activeDate, -1)}`}
          variant="secondary"
        >
          ← The day before
        </ButtonLink>
        {activeDate !== today && (
          <ButtonLink href="/distribution" variant="secondary">
            Back to today
          </ButtonLink>
        )}
        <ButtonLink
          href={`/distribution?date=${addDays(activeDate, 1)}`}
          variant="secondary"
        >
          The next day →
        </ButtonLink>

        <p className="ml-auto font-medium text-stone-700">
          {progress.done} of {progress.total} done
        </p>
      </div>

      {deliveries.length === 0 ? (
        <EmptyState
          title="No bread to deliver on this day"
          description="Add an order for this day and it will show up here."
        />
      ) : (
        <div className="space-y-3">
          {deliveries.map((item) => {
            const recorded = item.delivery.status !== "pending";

            return (
              <Card key={item.delivery.id}>
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-stone-900">
                      {item.customer.name}
                    </p>
                    <p className="text-stone-700">
                      {item.orderedQuantity} × {item.productName}
                    </p>
                    <p className="text-sm text-stone-500">
                      {item.customer.area} · {item.customer.phone}
                    </p>
                    {item.order.rescheduledFrom && (
                      <p className="mt-1 text-sm text-amber-700">
                        Moved here from {formatDate(item.order.rescheduledFrom)}
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
                  <p className="mb-4 border-l-2 border-stone-200 pl-4 text-stone-600">
                    {item.delivery.note}
                  </p>
                )}

                {recorded && (
                  <p className="mb-4 text-sm text-stone-500">
                    Already recorded. You can change it below if it was wrong.
                  </p>
                )}

                {/*
                  One form, three ways out of it. "Delivered in full" is the
                  answer nearly every time and stays a single click; the other
                  two ask first, because both are easy to press by accident and
                  both change what the customer owes.
                */}
                <form
                  action={recordDeliveryAction}
                  className="flex flex-wrap items-start gap-2"
                >
                  <input type="hidden" name="orderId" value={item.order.id} />
                  <input
                    type="hidden"
                    name="orderedQuantity"
                    value={item.orderedQuantity}
                  />

                  <GuardedSubmit
                    name="status"
                    value="delivered"
                    variant="primary"
                    label={`Delivered all ${item.orderedQuantity}`}
                  />

                  {/*
                    Hidden when only one was ordered — "some of one loaf" is not
                    a thing she can record.
                  */}
                  {item.orderedQuantity > 1 && (
                    <ConfirmButton
                      label="Only some of it"
                      variant="secondary"
                      question={`How many did ${item.customer.name} actually take?`}
                      confirmLabel="Save what they took"
                      name="status"
                      value="partial"
                    >
                      <label
                        htmlFor={`qty-${item.delivery.id}`}
                        className="block font-medium text-stone-900"
                      >
                        Number of {item.productName} delivered
                      </label>
                      <input
                        id={`qty-${item.delivery.id}`}
                        type="number"
                        name="deliveredQuantity"
                        min={1}
                        max={item.orderedQuantity - 1}
                        required
                        placeholder={`Fewer than ${item.orderedQuantity}`}
                        className={`${inputClass} mt-2 max-w-64`}
                      />
                      <p className="mt-2 text-sm text-stone-600">
                        They will only be charged for what you enter here.
                      </p>
                    </ConfirmButton>
                  )}

                  <ConfirmButton
                    label="Could not deliver"
                    variant="danger"
                    confirmVariant="danger"
                    question={`Record that ${item.customer.name} got no bread at all today?`}
                    confirmLabel="Yes, they got nothing"
                    name="status"
                    value="not_delivered"
                  >
                    <p className="text-stone-600">
                      They will not be charged for it, and it moves to{" "}
                      <span className="font-medium text-stone-800">
                        Needs sorting out
                      </span>{" "}
                      so you can give them a new day.
                    </p>
                  </ConfirmButton>
                </form>
              </Card>
            );
          })}
        </div>
      )}

      <QuestionForYou>
        <p>
          Right now bread can only be marked delivered here, on the laptop. Out
          on the road there is often no signal, and this screen needs one.
        </p>
        <p>
          <strong className="font-semibold text-stone-900">
            Who should mark the bread delivered while it is being dropped off —
            you, or whoever is driving?
          </strong>{" "}
          The answer changes how the phone app gets built, so it is worth
          settling before we start.
        </p>
      </QuestionForYou>
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
        title="Nothing to sort out"
        description="Every delivery has been recorded. Bread that could not be delivered, or a day nobody filled in, shows up here."
      />
    );
  }

  return (
    <>
      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.delivery.id} className="border-l-4 border-l-red-600">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-stone-900">
                  {item.customer.name}
                </p>
                <p className="text-stone-700">
                  {item.orderedQuantity} × {item.productName}
                </p>
                <p className="text-sm text-stone-500">
                  {item.customer.area} · {item.customer.phone}
                </p>
                <p className="mt-1.5 font-medium text-red-700">
                  Was due {formatDate(item.order.deliveryDate)} —{" "}
                  {item.daysLate === 1 ? "1 day ago" : `${item.daysLate} days ago`}
                </p>
                {item.order.rescheduledFrom && (
                  <p className="text-sm text-amber-700">
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
              <p className="mb-4 border-l-2 border-stone-200 pl-4 text-stone-600">
                {item.delivery.note}
              </p>
            )}

            <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
              <form
                action={rescheduleDeliveryAction}
                className="flex flex-wrap items-end gap-2"
              >
                <input type="hidden" name="orderId" value={item.order.id} />
                <div>
                  <label
                    htmlFor={`new-date-${item.delivery.id}`}
                    className="block font-medium text-stone-900"
                  >
                    Take it to them instead on
                  </label>
                  <input
                    id={`new-date-${item.delivery.id}`}
                    type="date"
                    name="newDate"
                    min={addDays(item.order.deliveryDate, 1)}
                    defaultValue={addDays(today, 1)}
                    className={`${inputClass} mt-2`}
                  />
                </div>
                <GuardedSubmit label="Move it to that day" variant="primary" />
              </form>

              <form action={recordDeliveryAction}>
                <input type="hidden" name="orderId" value={item.order.id} />
                <input
                  type="hidden"
                  name="orderedQuantity"
                  value={item.orderedQuantity}
                />
                <ConfirmButton
                  label="They did get it"
                  variant="secondary"
                  question={`Record that ${item.customer.name} received all ${item.orderedQuantity} after all?`}
                  confirmLabel="Yes, they received it"
                  name="status"
                  value="delivered"
                >
                  <p className="text-stone-600">
                    They will be charged for it, and it will leave this list.
                  </p>
                </ConfirmButton>
              </form>
            </div>
          </Card>
        ))}
      </div>

      <HowThisWorks>
        <p>
          Giving a failed delivery a new day{" "}
          <strong className="font-semibold text-stone-900">moves</strong> it
          rather than making a second one, so nobody is ever charged twice for
          the same bread.
        </p>
        <p>
          Bread that was only part delivered does not appear here, because we do
          not yet know whether you would take the rest out later or count it as
          gone. Tell us which, and it can go here too.
        </p>
      </HowThisWorks>
    </>
  );
}

function deliveryTone(status: string) {
  if (status === "delivered") return "good" as const;
  if (status === "partial") return "warn" as const;
  if (status === "not_delivered") return "bad" as const;
  return "neutral" as const;
}
