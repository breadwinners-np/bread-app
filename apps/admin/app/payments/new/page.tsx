import { PaymentForm } from "@/components/payment-form";
import { ButtonLink, Card, PageHeader } from "@/components/ui";
import { listCustomers } from "@/services/customers";
import { listOpenOrdersByCustomer } from "@/services/payments";

export const dynamic = "force-dynamic";

export default async function NewPaymentPage() {
  const [customers, openOrdersByCustomer] = await Promise.all([
    listCustomers(),
    listOpenOrdersByCustomer(),
  ]);

  return (
    <>
      <PageHeader
        title="Record a payment"
        subtitle="Money you have received"
        action={
          <ButtonLink href="/payments" variant="secondary">
            Cancel
          </ButtonLink>
        }
      />

      <Card className="max-w-2xl">
        <PaymentForm
          customers={customers}
          openOrdersByCustomer={openOrdersByCustomer}
        />
      </Card>
    </>
  );
}
