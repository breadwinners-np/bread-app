import {
  COST_CATEGORY_LABELS,
  formatDate,
  formatGhs,
  formatQuantity,
  monthOf,
  relativeDayLabel,
  todayIso,
} from "@bread/shared";

import {
  Badge,
  ButtonLink,
  Card,
  ComingSoon,
  EmptyState,
  PageHeader,
  QuestionForYou,
  SectionTitle,
  StatRow,
  StatTile,
} from "@/components/ui";
import { listCostsForDate, totalCostsForDate } from "@/services/costs";
import { listPurchases } from "@/services/inventory";

/**
 * Everything the bakery spends, on one screen.
 *
 * This used to be two: "Inventory" listed itemised purchases, "Costs" showed
 * the same purchases summarised plus a placeholder, and one of the two carried
 * a permanent "soon" badge in the sidebar. For the owner they are a single
 * question — what did I spend? — so they are now a single screen.
 */
export const dynamic = "force-dynamic";

export default async function SpendingPage() {
  const today = todayIso();
  const thisMonth = monthOf(today);

  const [purchases, otherCostsToday, spentToday] = await Promise.all([
    listPurchases(),
    listCostsForDate(today),
    totalCostsForDate(today),
  ]);

  const thisMonthPurchases = purchases.filter(
    (entry) => monthOf(entry.purchase.date) === thisMonth,
  );

  const spentThisMonth = thisMonthPurchases.reduce(
    (total, entry) => total + entry.totalPesewas,
    0,
  );

  const ingredientsThisMonth = thisMonthPurchases
    .filter((entry) => entry.item.category === "ingredients")
    .reduce((total, entry) => total + entry.totalPesewas, 0);

  // Grouped by day so the list reads like the run of receipts she keeps now.
  const byDate = new Map<string, typeof purchases>();
  for (const entry of purchases) {
    const existing = byDate.get(entry.purchase.date) ?? [];
    existing.push(entry);
    byDate.set(entry.purchase.date, existing);
  }

  return (
    <>
      <PageHeader
        title="Money out"
        subtitle="What you buy to bake the bread and get it to people"
        action={
          <ButtonLink href="/spending/new">Record something you bought</ButtonLink>
        }
      />

      <StatRow>
        <StatTile
          label="Spent today"
          value={formatGhs(spentToday)}
          hint="Everything recorded for today"
        />
        <StatTile
          label="Spent this month"
          value={formatGhs(spentThisMonth)}
          hint="Things you bought"
        />
        <StatTile
          label="Ingredients this month"
          value={formatGhs(ingredientsThisMonth)}
          hint="Flour, yeast, butter, sugar, salt"
        />
      </StatRow>

      {otherCostsToday.length > 0 && (
        <Card className="mb-10">
          <SectionTitle>Other money spent today</SectionTitle>
          <ul className="mt-4 divide-y divide-stone-100">
            {otherCostsToday.map((cost) => (
              <li
                key={cost.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div>
                  <p className="font-medium text-stone-900">
                    {COST_CATEGORY_LABELS[cost.category]}
                  </p>
                  {cost.note && (
                    <p className="text-stone-600">{cost.note}</p>
                  )}
                </div>
                <p className="font-semibold tabular-nums text-stone-900">
                  {formatGhs(cost.amountPesewas)}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mb-4">
        <SectionTitle>Things you bought</SectionTitle>
      </div>

      {purchases.length === 0 ? (
        <EmptyState
          title="Nothing recorded yet"
          description="Record what you buy and it will show up in your reports."
        />
      ) : (
        <div className="space-y-6">
          {[...byDate.entries()].map(([date, entries]) => {
            const dayTotal = entries.reduce(
              (total, entry) => total + entry.totalPesewas,
              0,
            );
            const dayLabel = relativeDayLabel(date, today);

            return (
              <Card key={date} padded={false}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-6 py-3.5">
                  <p className="font-medium text-stone-900">
                    {formatDate(date)}
                    {dayLabel && (
                      <span className="ml-2 font-normal text-stone-500">
                        {dayLabel}
                      </span>
                    )}
                  </p>
                  <p className="font-semibold tabular-nums text-stone-900">
                    {formatGhs(dayTotal)}
                  </p>
                </div>

                <ul className="divide-y divide-stone-100">
                  {entries.map((entry) => (
                    <li
                      key={entry.purchase.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2.5">
                          <p className="font-medium text-stone-900">
                            {entry.item.name}
                          </p>
                          <Badge
                            tone={
                              entry.item.category === "gas" ? "warn" : "neutral"
                            }
                          >
                            {COST_CATEGORY_LABELS[entry.item.category]}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-stone-600">
                          {formatQuantity(
                            entry.purchase.quantity,
                            entry.purchase.unit,
                          )}{" "}
                          at {formatGhs(entry.purchase.unitPricePesewas)} each
                        </p>
                        {(entry.purchase.supplier || entry.purchase.note) && (
                          <p className="text-sm text-stone-500">
                            {entry.purchase.supplier}
                            {entry.purchase.supplier && entry.purchase.note
                              ? " · "
                              : ""}
                            {entry.purchase.note}
                          </p>
                        )}
                      </div>

                      <p className="font-semibold tabular-nums text-stone-900">
                        {formatGhs(entry.totalPesewas)}
                      </p>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}

      <div className="mt-10">
        <ComingSoon
          title="Money spent on things you cannot count"
          description="Anything bought by the sack, kilo or cylinder you can record now, and it already counts in your reports. Transport, repairs and wages are not here yet, because how they should be counted depends on the answers below."
          questions={[
            "When you pay for a taxi to deliver bread, should that go against the day you paid it, or spread across the bread it carried?",
            "Do you want to see what one loaf costs you to make, or is the total for the day enough?",
            "When you work out what you have left over, should wages come out of it first?",
          ]}
        />
      </div>

      <QuestionForYou>
        <p>
          This screen shows{" "}
          <strong className="font-semibold text-stone-900">what you bought</strong>, not what is left in the store room. To know how much flour remains,
          somebody would have to write down how much goes into each bake, every
          day.
        </p>
        <p>Is that something you would want, or is knowing what you bought enough?</p>
      </QuestionForYou>
    </>
  );
}
