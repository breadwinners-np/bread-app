import Link from "next/link";
import { notFound } from "next/navigation";

import {
  CUSTOMER_TYPE_LABELS,
  ORDER_PAYMENT_STATE_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  formatDate,
  formatGhs,
  isAwaitingConfirmation,
  type OrderPaymentState,
} from "@bread/shared";

import {
  Badge,
  ButtonLink,
  Card,
  HowThisWorks,
  PageHeader,
  SectionTitle,
  StatRow,
  StatTile,
} from "@/components/ui";
import { getCustomer } from "@/services/customers";
import { listOrdersForCustomer } from "@/services/orders";
import {
  getCustomerAccount,
  listPaymentsForCustomer,
} from "@/services/payments";

// A dynamic segment with no generateStaticParams is prerendered at runtime and
// then cached indefinitely, and nothing revalidates this path. Without this the
// page freezes on whatever the first visitor saw.
export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomer(id);

  if (!customer) notFound();

  const [orders, payments, account] = await Promise.all([
    listOrdersForCustomer(id),
    listPaymentsForCustomer(id),
    getCustomerAccount(id),
  ]);

  // What each order still owes, so the history says paid or not paid rather
  // than leaving her to work it out from a running balance.
  const stateByOrder = new Map(
    account.lines.map((line) => [
      line.order.id,
      { state: line.state, outstandingPesewas: line.outstandingPesewas },
    ]),
  );

  return (
    <>
      <PageHeader
        title={customer.name}
        subtitle={`${CUSTOMER_TYPE_LABELS[customer.type]} · ${customer.area} · ${customer.phone}`}
        action={
          <ButtonLink href="/payments/new">Write down a payment</ButtonLink>
        }
      />

      <StatRow>
        <StatTile
          label="They owe you"
          value={formatGhs(Math.max(0, account.balancePesewas))}
          hint={
            account.balancePesewas < 0
              ? `They have paid ${formatGhs(-account.balancePesewas)} too much`
              : "Bread they have had but not paid for"
          }
        />
        <StatTile
          label="Bread still to come"
          value={formatGhs(account.notYetDuePesewas)}
          hint="Ordered, not delivered yet"
        />
        <StatTile
          label="Paid so far"
          value={formatGhs(account.paidPesewas)}
          hint={`${payments.length} ${payments.length === 1 ? "payment" : "payments"}`}
        />
        <StatTile label="Orders" value={String(customer.orderCount)} />
      </StatRow>

      {account.awaitingConfirmationPesewas > 0 && (
        <Card className="mb-10 border-l-4 border-l-amber-500">
          <p className="text-stone-700">
            They say they have paid{" "}
            <strong className="font-semibold text-stone-900">
              {formatGhs(account.awaitingConfirmationPesewas)}
            </strong>
            , which is not counted above yet.{" "}
            <Link href="/payments" className="font-medium text-stone-900 underline underline-offset-4">
              Check it on the Money in page
            </Link>
            .
          </p>
        </Card>
      )}

      {customer.notes && (
        <Card className="mb-10">
          <SectionTitle>Notes</SectionTitle>
          <p className="mt-2 text-stone-700">{customer.notes}</p>
        </Card>
      )}

      <Card className="mb-10">
        <SectionTitle>Orders</SectionTitle>

        {orders.length === 0 ? (
          <p className="mt-2 text-stone-600">No orders yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-stone-100">
            {orders.map((entry) => (
              <li
                key={entry.order.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div>
                  <p className="font-medium text-stone-900">
                    {formatDate(entry.order.deliveryDate)}
                  </p>
                  <p className="text-stone-600">
                    {entry.quantity} × {entry.productName}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
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

                  <PaymentBadge
                    state={stateByOrder.get(entry.order.id)?.state}
                    outstandingPesewas={
                      stateByOrder.get(entry.order.id)?.outstandingPesewas ?? 0
                    }
                  />

                  <p className="w-32 text-right font-semibold tabular-nums text-stone-900">
                    {formatGhs(entry.totalPesewas)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle>Payments</SectionTitle>

        {payments.length === 0 ? (
          <p className="mt-2 text-stone-600">No payments written down yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-stone-100">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <p className="font-medium text-stone-900">
                      {PAYMENT_METHOD_LABELS[payment.method]}
                    </p>
                    {isAwaitingConfirmation(payment) && (
                      <Badge tone="warn">Waiting for you to check</Badge>
                    )}
                    {payment.rejectedAt && <Badge tone="bad">Never came</Badge>}
                  </div>
                  <p className="text-sm text-stone-500">
                    {formatDate(payment.recordedAt.slice(0, 10))}
                    {payment.reference ? ` · ${payment.reference}` : ""}
                  </p>
                </div>
                <p
                  className={`font-semibold tabular-nums ${
                    payment.confirmedAt && !payment.rejectedAt
                      ? "text-stone-900"
                      : "text-stone-400"
                  }`}
                >
                  {formatGhs(payment.amountPesewas)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <HowThisWorks>
        <p>
          A customer owes you for bread{" "}
          <strong className="font-semibold text-stone-900">once it has reached them</strong>,
          not when the order is written down.
        </p>
        <p>
          If they took only some of what they ordered, they are charged for what
          they took. Tell us if you would rather they paid the full amount
          anyway, and it can be changed.
        </p>
      </HowThisWorks>
    </>
  );
}

/** How much of one order is still to be paid. */
function PaymentBadge({
  state,
  outstandingPesewas,
}: {
  state?: OrderPaymentState;
  outstandingPesewas: number;
}) {
  if (!state || state === "not_due") return null;

  const tone =
    state === "paid" ? "good" : state === "part_paid" ? "warn" : "bad";

  return (
    <Badge tone={tone}>
      {state === "paid"
        ? ORDER_PAYMENT_STATE_LABELS.paid
        : `${ORDER_PAYMENT_STATE_LABELS[state]} — ${formatGhs(outstandingPesewas)} left`}
    </Badge>
  );
}
