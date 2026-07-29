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
import { ConfirmButton, GuardedSubmit } from "@/components/confirm-button";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  PageHeader,
  QuestionForYou,
  SectionTitle,
  StatRow,
  StatTile,
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
        title="Money in"
        subtitle="Cash, cheques and mobile money"
        action={
          <ButtonLink href="/payments/new">Write down a payment</ButtonLink>
        }
      />

      {pending.length > 0 && (
        <Card className="mb-10 border-l-4 border-l-amber-500">
          <SectionTitle>
            {pending.length === 1
              ? "1 customer says they have paid you"
              : `${pending.length} customers say they have paid you`}
          </SectionTitle>
          <p className="mt-1.5 text-stone-600">
            This came from the customer&apos;s own phone. It does not count
            against what they owe until you say the money reached you.
          </p>

          <ul className="mt-5 space-y-4 border-t border-stone-100 pt-5">
            {pending.map((entry) => (
              <li
                key={entry.payment.id}
                className="flex flex-wrap items-start justify-between gap-4"
              >
                <div>
                  <p className="font-medium text-stone-900">
                    {entry.customerName} —{" "}
                    <span className="tabular-nums">
                      {formatGhs(entry.payment.amountPesewas)}
                    </span>
                  </p>
                  <p className="text-stone-600">
                    {PAYMENT_METHOD_LABELS[entry.payment.method]}
                    {entry.payment.reference
                      ? ` · ${entry.payment.reference}`
                      : ""}
                    {entry.orderLabel ? ` · for ${entry.orderLabel}` : ""}
                  </p>
                  <p className="text-sm text-stone-500">
                    They told you on{" "}
                    {formatDate(entry.payment.recordedAt.slice(0, 10))}
                  </p>
                </div>

                <div className="flex flex-wrap items-start gap-2">
                  <form action={decidePaymentAction}>
                    <input
                      type="hidden"
                      name="paymentId"
                      value={entry.payment.id}
                    />
                    <input type="hidden" name="decision" value="confirm" />
                    <GuardedSubmit label="Yes, it reached me" variant="primary" />
                  </form>

                  {/*
                    Saying no writes off money the customer believes they have
                    paid, so it asks first. Saying yes does not — it is the
                    ordinary outcome, and it stays visible on the list below if
                    she presses it by mistake.
                  */}
                  <form action={decidePaymentAction}>
                    <input
                      type="hidden"
                      name="paymentId"
                      value={entry.payment.id}
                    />
                    <ConfirmButton
                      label="No, it did not"
                      variant="danger"
                      confirmVariant="danger"
                      question={`Record that ${formatGhs(entry.payment.amountPesewas)} from ${entry.customerName} never reached you?`}
                      confirmLabel="Yes, it never came"
                      name="decision"
                      value="reject"
                    >
                      <p className="text-stone-600">
                        They will still owe this money, and it stays on the list
                        below crossed out.
                      </p>
                    </ConfirmButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <StatRow>
        <StatTile
          label="Came in this month"
          value={formatGhs(overview.receivedThisMonthPesewas)}
          hint="Money you have agreed reached you"
        />
        <StatTile
          label="Still owed to you"
          value={formatGhs(overview.owedAcrossCustomersPesewas)}
          hint="Bread delivered but not paid for"
        />
        <StatTile
          label="Waiting for you to check"
          value={formatGhs(overview.awaitingConfirmationPesewas)}
          hint={
            overview.awaitingConfirmationCount === 1
              ? "1 payment"
              : `${overview.awaitingConfirmationCount} payments`
          }
        />
      </StatRow>

      {payments.length === 0 ? (
        <EmptyState
          title="No payments written down yet"
          description="Write down a payment and it will go against the bread that customer has had."
        />
      ) : (
        <div className="space-y-4">
          {[...byDate.entries()].map(([date, entries]) => {
            const dayLabel = relativeDayLabel(date, today);
            // Only money she has agreed arrived. A claim waiting on her, or one
            // she has said never came, must not pad the day's takings.
            const dayTotal = entries
              .filter((entry) => isPaymentCounted(entry.payment))
              .reduce((total, entry) => total + entry.payment.amountPesewas, 0);

            return (
              <Card key={date} padded={false}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-6 py-3.5">
                  <p className="font-medium text-stone-900">
                    {formatDate(date)}
                    {dayLabel && (
                      <span className="ml-2 font-normal text-stone-500">
                        {dayLabel}
                      </span>
                    )}
                  </p>
                  <p className="font-semibold tabular-nums text-stone-900">
                    {formatGhs(dayTotal)}
                  </p>
                </div>

                <ul className="divide-y divide-stone-100">
                  {entries.map((entry) => (
                    <li
                      key={entry.payment.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2.5">
                          <p className="font-medium text-stone-900">
                            {entry.customerName}
                          </p>
                          <Badge tone={toneFor(entry)}>{stateLabel(entry)}</Badge>
                        </div>
                        <p className="mt-0.5 text-stone-600">
                          {PAYMENT_METHOD_LABELS[entry.payment.method]}
                          {entry.payment.reference
                            ? ` · ${entry.payment.reference}`
                            : ""}
                        </p>
                        <p className="text-sm text-stone-500">
                          {entry.orderLabel
                            ? `For ${entry.orderLabel}`
                            : "Not tied to one day — it pays off their oldest bread first"}
                          {entry.payment.note ? ` · ${entry.payment.note}` : ""}
                        </p>
                      </div>

                      <p
                        className={`font-semibold tabular-nums ${
                          entry.payment.rejectedAt
                            ? "text-stone-400 line-through"
                            : isPaymentCounted(entry.payment)
                              ? "text-stone-900"
                              : "text-stone-500"
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

      <QuestionForYou>
        <p>
          At the moment a cheque counts as money the day you write it down, even
          though the bank has not paid it yet.{" "}
          <strong className="font-semibold text-stone-900">
            Would you rather it only counted once the bank has cleared it?
          </strong>{" "}
          And when a cheque bounces, what should happen to what that customer
          owes?
        </p>
        <p>
          Nothing here stops a customer paying more than they owe and sitting in
          credit.{" "}
          <strong className="font-semibold text-stone-900">
            Is that allowed, and up to how much?
          </strong>
        </p>
      </QuestionForYou>
    </>
  );
}

function toneFor(entry: PaymentWithContext) {
  if (entry.payment.rejectedAt) return "bad" as const;
  if (isAwaitingConfirmation(entry.payment)) return "warn" as const;
  return entry.payment.source === "app" ? "info" : ("good" as const);
}

function stateLabel(entry: PaymentWithContext): string {
  if (entry.payment.rejectedAt) return "Never came";
  if (isAwaitingConfirmation(entry.payment)) return "Waiting for you";
  if (entry.payment.source === "app") return "From their phone, you agreed";
  return "You wrote it down";
}
