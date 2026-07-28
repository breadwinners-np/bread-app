import { todayIso } from "@bread/shared";

import { OrderForm } from "@/components/order-form";
import { ButtonLink, Card, PageHeader } from "@/components/ui";
import { listCustomers } from "@/services/customers";
import { listProducts } from "@/services/products";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  const [customers, products] = await Promise.all([
    listCustomers(),
    listProducts(),
  ]);

  return (
    <>
      <PageHeader
        title="Add an order"
        subtitle="For orders that come in by phone or text"
        action={
          <ButtonLink href="/orders" variant="secondary">
            Cancel
          </ButtonLink>
        }
      />

      <Card className="max-w-2xl">
        <OrderForm
          customers={customers}
          products={products}
          defaultDate={todayIso()}
        />
      </Card>
    </>
  );
}
