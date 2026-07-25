import { COST_CATEGORY_LABELS, formatGhs, todayIso } from "@bread/shared";

import { Card, ComingSoon, PageHeader, SectionTitle } from "@/components/ui";
import { listCostsForDate } from "@/services/costs";

export const dynamic = "force-dynamic";

export default async function CostsPage() {
  const today = todayIso();
  const costs = await listCostsForDate(today);

  return (
    <>
      <PageHeader title="Costs" subtitle="Gas, ingredients and transport" />

      {costs.length > 0 && (
        <Card className="mb-8">
          <SectionTitle>Recorded today</SectionTitle>
          <ul className="divide-y divide-stone-200">
            {costs.map((cost) => (
              <li
                key={cost.id}
                className="flex items-center justify-between py-4"
              >
                <div>
                  <p className="font-semibold text-stone-900">
                    {COST_CATEGORY_LABELS[cost.category]}
                  </p>
                  {cost.note && <p className="text-stone-500">{cost.note}</p>}
                </div>
                <p className="font-semibold tabular-nums text-stone-900">
                  {formatGhs(cost.amountPesewas)}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ComingSoon
        title="Recording costs is not built yet"
        description="This is where you will add a cost, attach a receipt photo, and see costs against revenue over time. The list above is sample data, shown so the shape of the screen is visible."
        blockedBy={[
          "CST-3: are costs a daily total, or split per batch so you can see profit per loaf?",
          "CST-3: does profit include wages?",
        ]}
      />
    </>
  );
}
