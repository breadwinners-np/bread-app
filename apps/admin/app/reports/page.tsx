import { ComingSoon, PageHeader } from "@/components/ui";

export default function ReportsPage() {
  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Daily and monthly summaries, with Excel and PDF export"
      />

      <ComingSoon
        title="Not built yet"
        description="This is where the daily and monthly summaries will live: bread delivered, revenue against costs, who owes what, and how each business customer's monthly agreement is tracking. Charts will use Recharts, with export to Excel and PDF."
        blockedBy={[
          "CST-3: cost granularity decides whether profit per loaf is possible",
          "ORD-3: monthly commitment tracking needs the daily split rule",
          "PAY-3: revenue reporting depends on when a cheque counts as paid",
        ]}
      />
    </>
  );
}
