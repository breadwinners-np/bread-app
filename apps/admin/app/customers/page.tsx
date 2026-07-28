import Link from "next/link";

import { CUSTOMER_TYPE_LABELS, formatGhs } from "@bread/shared";

import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { listCustomers } from "@/services/customers";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const customers = await listCustomers();
  const owing = customers.filter((customer) => customer.balancePesewas > 0);

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={
          owing.length > 0
            ? `${owing.length} of ${customers.length} owe money`
            : `${customers.length} customers`
        }
        action={<ButtonLink href="/customers/new">Add a customer</ButtonLink>}
      />

      {customers.length === 0 ? (
        <EmptyState
          title="No customers yet"
          description="Add the first customer to start recording orders."
        />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-stone-200">
            {customers.map((customer) => (
              <li key={customer.id}>
                <Link
                  href={`/customers/${customer.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 hover:bg-stone-50"
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <p className="text-lg font-semibold text-stone-900">
                        {customer.name}
                      </p>
                      <Badge
                        tone={customer.type === "business" ? "info" : "neutral"}
                      >
                        {CUSTOMER_TYPE_LABELS[customer.type]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-stone-500">
                      {customer.area} · {customer.phone}
                    </p>
                  </div>

                  <div className="text-right">
                    <p
                      className={`text-lg font-semibold tabular-nums ${
                        customer.balancePesewas > 0
                          ? "text-red-700"
                          : "text-stone-500"
                      }`}
                    >
                      {formatGhs(Math.abs(customer.balancePesewas))}
                    </p>
                    <p className="text-sm text-stone-500">
                      {customer.balancePesewas > 0
                        ? "owed to you"
                        : customer.balancePesewas < 0
                          ? "in credit"
                          : "settled"}
                    </p>
                    {customer.awaitingConfirmationPesewas > 0 && (
                      <p className="text-sm font-medium text-amber-800">
                        Says they paid{" "}
                        {formatGhs(customer.awaitingConfirmationPesewas)}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="mt-6 rounded-xl bg-amber-50 px-5 py-4 text-amber-900">
        <strong className="font-semibold">Balances count delivered bread
        only.</strong>{" "}
        An order that has not been delivered is not owed yet (decision 0012).
        Cheques count from the day they were recorded, whether or not they have
        cleared (PAY-3), and nothing stops a customer going into credit (PAY-6).
      </p>
    </>
  );
}
