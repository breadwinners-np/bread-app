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
  EmptyState,
  PageHeader,
  SectionTitle,
  StatTile,
} from "@/components/ui";
import { getCustomer } from "@/services/customers";
import { listOrdersForCustomer } from "@/services/orders";
import {
  getCustomerAccount,
  listPaymentsForCustomer,
} from "@/services/payments";

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
          <ButtonLink href="/payments/new">Record a payment</ButtonLink>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Owes you"
          value={formatGhs(Math.max(0, account.balancePesewas))}
          hint={
            account.balancePesewas < 0
              ? `${formatGhs(-account.balancePesewas)} in credit`
              : "Bread delivered, not paid for"
          }
        />
        <StatTile
          label="Coming up"
          value={formatGhs(account.notYetDuePesewas)}
          hint="Ordered, not delivered yet"
        />
        <StatTile
          label="Paid so far"
          value={formatGhs(account.paidPesewas)}
          hint={`${payments.length} ${payments.length === 1 ? "payment" : "payments"}`}
        />
        <StatTile label="Orders" value={String(customer.orderCount)} />
      </div>

      {account.awaitingConfirmationPesewas > 0 && (
        <Card className="mb-8 border-l-4 border-l-amber-500 bg-amber-50">
          <p className="text-lg text-stone-800">
            They say they have paid{" "}
            <strong className="font-bold">
              {formatGhs(account.awaitingConfirmationPesewas)}
            </strong>{" "}
            which is not counted above yet.{" "}
            <a href="/payments" className="font-semibold underline">
              Confirm it on the payments page
            </a>
            .
          </p>
        </Card>
      )}

      {customer.notes && (
        <Card className="mb-8">
          <SectionTitle>Notes</SectionTitle>
          <p className="text-stone-700">{customer.notes}</p>
        </Card>
      )}

      <Card className="mb-8">
        <SectionTitle>Orders</SectionTitle>

        {orders.length === 0 ? (
          <EmptyState title="No orders yet" />
        ) : (
          <ul className="divide-y divide-stone-200">
            {orders.map((entry) => (
              <li
                key={entry.order.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div>
                  <p className="font-semibold text-stone-900">
                    {formatDate(entry.order.deliveryDate)}
                  </p>
                  <p className="text-stone-500">
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

                  <p className="w-28 text-right font-semibold tabular-nums text-stone-900">
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
          <EmptyState title="No payments recorded" />
        ) : (
          <ul className="divide-y divide-stone-200">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="font-semibold text-stone-900">
                      {PAYMENT_METHOD_LABELS[payment.method]}
                    </p>
                    {isAwaitingConfirmation(payment) && (
                      <Badge tone="warn">Waiting for you to confirm</Badge>
                    )}
                    {payment.rejectedAt && <Badge tone="bad">Never arrived</Badge>}
                  </div>
                  <p className="text-stone-500">
                    {formatDate(payment.recordedAt.slice(0, 10))}
                    {payment.reference ? ` · ${payment.reference}` : ""}
                  </p>
                </div>
                <p
                  className={`font-semibold tabular-nums ${
                    payment.confirmedAt && !payment.rejectedAt
                      ? "text-green-700"
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

      <p className="mt-8 rounded-xl bg-amber-50 px-5 py-4 text-amber-900">
        <strong className="font-semibold">An order is only owed once it has
        been delivered</strong>{" "}
        (decision 0012). A part delivery is owed for what actually arrived, which
        is a provisional answer to an open question (DST-7) — say the word if a
        short drop should still be charged in full.
      </p>
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
