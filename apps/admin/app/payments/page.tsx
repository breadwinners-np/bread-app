import {
  PAYMENT_METHOD_LABELS,
  formatDate,
  formatGhs,
  isAwaitingConfirmation,
  isPaymentCounted,
  relativeDayLabel,
  todayIso,
} from "@bread/shared";

import { decidePaymentAction } from "@/app/actions";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  PageHeader,
  SectionTitle,
  StatTile,
  buttonClass,
} from "@/components/ui";
import {
  getPaymentsOverview,
  listPayments,
  listPaymentsAwaitingConfirmation,
  type PaymentWithContext,
} from "@/services/payments";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const [payments, pending, overview] = await Promise.all([
    listPayments(),
    listPaymentsAwaitingConfirmation(),
    getPaymentsOverview(),
  ]);

  const today = todayIso();

  // Grouped by the day the money was recorded, so the page reads like the book
  // she keeps now.
  const byDate = new Map<string, PaymentWithContext[]>();
  for (const entry of payments) {
    const date = entry.payment.recordedAt.slice(0, 10);
    byDate.set(date, [...(byDate.get(date) ?? []), entry]);
  }

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle="Cash, cheques and mobile money"
        action={<ButtonLink href="/payments/new">Record a payment</ButtonLink>}
      />

      {pending.length > 0 && (
        <Card className="mb-8 border-l-4 border-l-amber-500 bg-amber-50">
          <SectionTitle>
            {pending.length === 1
              ? "1 customer says they have paid"
              : `${pending.length} customers say they have paid`}
          </SectionTitle>
          <p className="mb-5 text-stone-700">
            These came from a customer&apos;s phone. They do not count against
            what the customer owes until you say the money arrived.
          </p>

          <ul className="space-y-4">
            {pending.map((entry) => (
              <li
                key={entry.payment.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white px-5 py-4"
              >
                <div>
                  <p className="text-lg font-semibold text-stone-900">
                    {entry.customerName} — {formatGhs(entry.payment.amountPesewas)}
                  </p>
                  <p className="text-stone-600">
                    {PAYMENT_METHOD_LABELS[entry.payment.method]}
                    {entry.payment.reference ? ` · ${entry.payment.reference}` : ""}
                    {entry.orderLabel ? ` · for ${entry.orderLabel}` : ""}
                  </p>
                  <p className="text-sm text-stone-500">
                    Reported {formatDate(entry.payment.recordedAt.slice(0, 10))}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <form action={decidePaymentAction}>
                    <input type="hidden" name="paymentId" value={entry.payment.id} />
                    <input type="hidden" name="decision" value="confirm" />
                    <button type="submit" className={buttonClass("primary")}>
                      Yes, it arrived
                    </button>
                  </form>

                  <form action={decidePaymentAction}>
                    <input type="hidden" name="paymentId" value={entry.payment.id} />
                    <input type="hidden" name="decision" value="reject" />
                    <button type="submit" className={buttonClass("quiet")}>
                      No, it did not
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Received this month"
          value={formatGhs(overview.receivedThisMonthPesewas)}
        />
        <StatTile
          label="Owed to you"
          value={formatGhs(overview.owedAcrossCustomersPesewas)}
          hint="Bread delivered but not paid for"
        />
        <StatTile
          label="Waiting for you to confirm"
          value={formatGhs(overview.awaitingConfirmationPesewas)}
          hint={
            overview.awaitingConfirmationCount === 1
              ? "1 payment"
              : `${overview.awaitingConfirmationCount} payments`
          }
        />
      </div>

      {payments.length === 0 ? (
        <EmptyState
          title="No payments recorded yet"
          description="Record a payment and it will show against the customer's orders."
        />
      ) : (
        <div className="space-y-6">
          {[...byDate.entries()].map(([date, entries]) => {
            const dayLabel = relativeDayLabel(date, today);
            // Only money she has agreed arrived. A claim waiting on her, or one
            // she has said never came, must not pad the day's takings.
            const dayTotal = entries
              .filter((entry) => isPaymentCounted(entry.payment))
              .reduce((total, entry) => total + entry.payment.amountPesewas, 0);

            return (
              <Card key={date} className="p-0">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-6 py-4">
                  <p className="text-lg font-semibold text-stone-900">
                    {formatDate(date)}
                    {dayLabel && (
                      <span className="ml-2 font-normal text-stone-500">
                        {dayLabel}
                      </span>
                    )}
                  </p>
                  <p className="text-lg font-bold tabular-nums text-stone-900">
                    {formatGhs(dayTotal)}
                  </p>
                </div>

                <ul className="divide-y divide-stone-200">
                  {entries.map((entry) => (
                    <li
                      key={entry.payment.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="text-lg font-semibold text-stone-900">
                            {entry.customerName}
                          </p>
                          <Badge tone={toneFor(entry)}>{stateLabel(entry)}</Badge>
                        </div>
                        <p className="mt-1 text-stone-600">
                          {PAYMENT_METHOD_LABELS[entry.payment.method]}
                          {entry.payment.reference
                            ? ` · ${entry.payment.reference}`
                            : ""}
                        </p>
                        <p className="text-stone-500">
                          {entry.orderLabel
                            ? `For ${entry.orderLabel}`
                            : "On the account — goes against the oldest unpaid bread first"}
                          {entry.payment.note ? ` · ${entry.payment.note}` : ""}
                        </p>
                      </div>

                      <p
                        className={`text-lg font-semibold tabular-nums ${
                          entry.payment.rejectedAt
                            ? "text-stone-400 line-through"
                            : isPaymentCounted(entry.payment)
                              ? "text-green-700"
                              : "text-stone-400"
                        }`}
                      >
                        {formatGhs(entry.payment.amountPesewas)}
                      </p>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}

      <p className="mt-8 rounded-xl bg-amber-50 px-5 py-4 text-amber-900">
        <strong className="font-semibold">A cheque counts from the day you
        record it.</strong>{" "}
        Whether it should only count once the bank clears it — and what happens
        to the balance when one bounces — is still an open question (PAY-3).
        Whether a customer may pay more than they owe and sit in credit is
        another (PAY-6); nothing here stops it.
      </p>
    </>
  );
}

function toneFor(entry: PaymentWithContext) {
  if (entry.payment.rejectedAt) return "bad" as const;
  if (isAwaitingConfirmation(entry.payment)) return "warn" as const;
  return entry.payment.source === "app" ? "info" : ("good" as const);
}

function stateLabel(entry: PaymentWithContext): string {
  if (entry.payment.rejectedAt) return "Never arrived";
  if (isAwaitingConfirmation(entry.payment)) return "Waiting for you";
  if (entry.payment.source === "app") return "From the app, confirmed";
  return "Recorded by you";
}
