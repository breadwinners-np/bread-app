import { todayIso } from "@bread/shared";

import { PurchaseForm } from "@/components/purchase-form";
import { ButtonLink, Card, PageHeader } from "@/components/ui";
import { listSupplyItems } from "@/services/inventory";

export const dynamic = "force-dynamic";

export default async function NewPurchasePage() {
  const items = await listSupplyItems();

  return (
    <>
      <PageHeader
        title="Record a purchase"
        subtitle="Flour, yeast, butter, sugar, salt, or gas"
        action={
          <ButtonLink href="/inventory" variant="quiet">
            Cancel
          </ButtonLink>
        }
      />

      <Card className="max-w-2xl">
        <PurchaseForm items={items} defaultDate={todayIso()} />
      </Card>
    </>
  );
}
