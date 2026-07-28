import {
  COST_CATEGORY_LABELS,
  addDays,
  formatGhs,
  formatQuantity,
  todayIso,
} from "@bread/shared";

import {
  ButtonLink,
  Card,
  ComingSoon,
  PageHeader,
  SectionTitle,
  StatTile,
} from "@/components/ui";
import { listCostsForDate, totalCostsForDate } from "@/services/costs";
import { listPurchasesForDate, purchaseTotalsByCategory } from "@/services/inventory";

export const dynamic = "force-dynamic";

export default async function CostsPage() {
  const today = todayIso();
  const monthStart = `${today.slice(0, 7)}-01`;

  const [costs, purchases, totalToday, byCategory] = await Promise.all([
    listCostsForDate(today),
    listPurchasesForDate(today),
    totalCostsForDate(today),
    purchaseTotalsByCategory(monthStart, addDays(today, 1)),
  ]);

  return (
    <>
      <PageHeader
        title="Costs"
        subtitle="Gas, ingredients and transport"
        action={
          <ButtonLink href="/inventory/new" variant="secondary">
            Record a purchase
          </ButtonLink>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatTile label="Spent today" value={formatGhs(totalToday)} />
        <StatTile
          label="Ingredients this month"
          value={formatGhs(byCategory.ingredients)}
        />
        <StatTile label="Gas this month" value={formatGhs(byCategory.gas)} />
      </div>

      {purchases.length > 0 && (
        <Card className="mb-8">
          <SectionTitle>Bought today</SectionTitle>
          <ul className="divide-y divide-stone-200">
            {purchases.map((entry) => (
              <li
                key={entry.purchase.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div>
                  <p className="font-semibold text-stone-900">
                    {entry.item.name}
                  </p>
                  <p className="text-stone-500">
                    {formatQuantity(entry.purchase.quantity, entry.purchase.unit)}{" "}
                    at {formatGhs(entry.purchase.unitPricePesewas)} each
                  </p>
                </div>
                <p className="font-semibold tabular-nums text-stone-900">
                  {formatGhs(entry.totalPesewas)}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-stone-500">
            Itemised purchases live in{" "}
            <a href="/inventory" className="font-semibold underline">
              Inventory
            </a>
            .
          </p>
        </Card>
      )}

      {costs.length > 0 && (
        <Card className="mb-8">
          <SectionTitle>Other costs today</SectionTitle>
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
        title="Recording non-item costs is not built yet"
        description="Anything bought by the sack, kilo or cylinder is recorded in Inventory and already counts here. What is still missing is a form for costs with no countable item — transport, repairs, wages — plus costs charted against revenue over time."
        blockedBy={[
          "CST-3: does a purchase count on the day it was bought, or spread across the days it is used?",
          "CST-3: are costs split per batch so you can see profit per loaf?",
          "CST-3: does profit include wages?",
        ]}
      />
    </>
  );
}
