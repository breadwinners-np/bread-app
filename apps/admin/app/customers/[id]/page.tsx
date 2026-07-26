import { notFound } from "next/navigation";

import {
  CUSTOMER_TYPE_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  formatDate,
  formatGhs,
} from "@bread/shared";

import { BreadLines } from "@/components/bread-lines";
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
import { listPaymentsForCustomer } from "@/services/payments";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomer(id);

  if (!customer) notFound();

  const [orders, payments] = await Promise.all([
    listOrdersForCustomer(id),
    listPaymentsForCustomer(id),
  ]);

  return (
    <>
      <PageHeader
        title={customer.name}
        subtitle={`${CUSTOMER_TYPE_LABELS[customer.type]} · ${customer.area} · ${customer.phone}`}
        action={
          <ButtonLink href="/customers" variant="quiet">
            Back to customers
          </ButtonLink>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Balance"
          value={formatGhs(customer.balancePesewas)}
          hint={customer.balancePesewas > 0 ? "owed to you" : "settled"}
        />
        <StatTile label="Orders" value={String(customer.orderCount)} />
        <StatTile label="Payments recorded" value={String(payments.length)} />
      </div>

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
                  <p>
                    <BreadLines lines={entry.lines} />
                  </p>
                </div>

                <div className="flex items-center gap-4">
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
                  <p className="font-semibold text-stone-900">
                    {PAYMENT_METHOD_LABELS[payment.method]}
                  </p>
                  <p className="text-stone-500">
                    {formatDate(payment.recordedAt.slice(0, 10))}
                    {payment.reference ? ` · ${payment.reference}` : ""}
                  </p>
                </div>
                <p className="font-semibold tabular-nums text-green-700">
                  {formatGhs(payment.amountPesewas)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
