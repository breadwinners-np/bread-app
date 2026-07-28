import Link from "next/link";

import { CUSTOMER_TYPE_LABELS, formatGhs } from "@bread/shared";

import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  HowThisWorks,
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
            ? `${owing.length} of ${customers.length} owe you money`
            : `${customers.length} customers, nobody owes you anything`
        }
        action={<ButtonLink href="/customers/new">Add a customer</ButtonLink>}
      />

      {customers.length > 0 && (
        <p className="mb-4 text-stone-600">
          Click a customer to see everything they have ordered and paid.
        </p>
      )}

      {customers.length === 0 ? (
        <EmptyState
          title="No customers yet"
          description="Add your first customer, then you can write down their orders."
        />
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-stone-100">
            {customers.map((customer) => (
              <li key={customer.id}>
                {/*
                  The whole row is the link, so the target is as large as
                  possible — but a row that only reveals itself on hover is
                  invisible to someone who does not expect it, so it also
                  carries a visible "Open" affordance. That is a span, not a
                  second link: an anchor inside an anchor is invalid, and the
                  row already handles the click.
                */}
                <Link
                  href={`/customers/${customer.id}`}
                  className="group flex flex-wrap items-center justify-between gap-3 px-6 py-4 hover:bg-stone-50"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <p className="font-medium text-stone-900 underline decoration-stone-300 underline-offset-4 group-hover:decoration-stone-900">
                        {customer.name}
                      </p>
                      <Badge
                        tone={customer.type === "business" ? "info" : "neutral"}
                      >
                        {CUSTOMER_TYPE_LABELS[customer.type]}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-stone-600">
                      {customer.area} · {customer.phone}
                    </p>
                  </div>

                  {/*
                    The amount is never alone: the words underneath say which
                    way the money is going, so nothing depends on noticing that
                    the number is red.
                  */}
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p
                        className={`font-semibold tabular-nums ${
                          customer.balancePesewas > 0
                            ? "text-red-700"
                            : "text-stone-500"
                        }`}
                      >
                        {formatGhs(Math.abs(customer.balancePesewas))}
                      </p>
                      <p className="text-sm text-stone-500">
                        {customer.balancePesewas > 0
                          ? "they owe you"
                          : customer.balancePesewas < 0
                            ? "you owe them"
                            : "all settled"}
                      </p>
                      {customer.awaitingConfirmationPesewas > 0 && (
                        <p className="text-sm font-medium text-amber-700">
                          Says they paid{" "}
                          {formatGhs(customer.awaitingConfirmationPesewas)}
                        </p>
                      )}
                    </div>

                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-stone-300 px-3.5 py-2 font-medium text-stone-700 group-hover:border-stone-900 group-hover:text-stone-900">
                      Open
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <HowThisWorks>
        <p>
          What someone owes counts{" "}
          <strong className="font-semibold text-stone-900">only bread they have received</strong>
          . An order for tomorrow is not money owed until the bread reaches
          them.
        </p>
        <p>
          A cheque counts from the day you write it down, not the day the bank
          pays it.
        </p>
      </HowThisWorks>
    </>
  );
}
