import { ComingSoon, PageHeader } from "@/components/ui";

export default function PaymentsPage() {
  return (
    <>
      <PageHeader
        title="Payments"
        subtitle="Recording cash, cheques and mobile money"
      />

      <ComingSoon
        title="Not built yet"
        description="This is where you will record a payment, attach a photo of the cheque or receipt, and see what each customer still owes. Payments already exist in the data — you can see them on a customer's page — but recording new ones needs the rules below settled first, because they change what a balance means."
        blockedBy={[
          "PAY-3: is a cheque paid when you receive it, or when it clears?",
          "PAY-6: can a customer go into credit, and by how much?",
          "PAY-6: do wholesale customers pay up front or afterwards?",
        ]}
      />
    </>
  );
}
