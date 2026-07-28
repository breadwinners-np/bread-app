import { CustomerForm } from "@/components/customer-form";
import { ButtonLink, Card, PageHeader } from "@/components/ui";

export default function NewCustomerPage() {
  return (
    <>
      <PageHeader
        title="Add a customer"
        action={
          <ButtonLink href="/customers" variant="quiet">
            Cancel
          </ButtonLink>
        }
      />

      <Card className="max-w-2xl">
        <CustomerForm />
      </Card>
    </>
  );
}
