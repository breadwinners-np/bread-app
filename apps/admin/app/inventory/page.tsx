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
  EmptyState,
  PageHeader,
  StatTile,
} from "@/components/ui";
import { listPurchases } from "@/services/inventory";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const purchases = await listPurchases();
  const today = todayIso();
  const thisMonth = monthOf(today);

  const spentToday = purchases
    .filter((entry) => entry.purchase.date === today)
    .reduce((total, entry) => total + entry.totalPesewas, 0);

  const spentThisMonth = purchases
    .filter((entry) => monthOf(entry.purchase.date) === thisMonth)
    .reduce((total, entry) => total + entry.totalPesewas, 0);

  const ingredientsThisMonth = purchases
    .filter(
      (entry) =>
        monthOf(entry.purchase.date) === thisMonth &&
        entry.item.category === "ingredients",
    )
    .reduce((total, entry) => total + entry.totalPesewas, 0);

  // Group by day so the list reads like a run of receipts.
  const byDate = new Map<string, typeof purchases>();
  for (const entry of purchases) {
    const existing = byDate.get(entry.purchase.date) ?? [];
    existing.push(entry);
    byDate.set(entry.purchase.date, existing);
  }

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="What you bought, when, and for how much"
        action={<ButtonLink href="/inventory/new">Record a purchase</ButtonLink>}
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatTile label="Bought today" value={formatGhs(spentToday)} />
        <StatTile label="Bought this month" value={formatGhs(spentThisMonth)} />
        <StatTile
          label="Ingredients this month"
          value={formatGhs(ingredientsThisMonth)}
        />
      </div>

      {purchases.length === 0 ? (
        <EmptyState
          title="Nothing recorded yet"
          description="Record what you buy and it will feed the cost reports."
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
              <Card key={date} className="p-0">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-6 py-4">
                  <p className="text-lg font-semibold text-stone-900">
                    {formatDate(date)}
                    {dayLabel && (
                      <span className="ml-2 font-normal text-stone-500">
                        {dayLabel}
                      </span>
                    )}
                  </p>
                  <p className="text-lg font-bold tabular-nums text-stone-900">
                    {formatGhs(dayTotal)}
                  </p>
                </div>

                <ul className="divide-y divide-stone-200">
                  {entries.map((entry) => (
                    <li
                      key={entry.purchase.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="text-lg font-semibold text-stone-900">
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
                        <p className="mt-1 text-stone-600">
                          {formatQuantity(
                            entry.purchase.quantity,
                            entry.purchase.unit,
                          )}{" "}
                          at {formatGhs(entry.purchase.unitPricePesewas)} each
                        </p>
                        {(entry.purchase.supplier || entry.purchase.note) && (
                          <p className="text-stone-500">
                            {entry.purchase.supplier}
                            {entry.purchase.supplier && entry.purchase.note
                              ? " · "
                              : ""}
                            {entry.purchase.note}
                          </p>
                        )}
                      </div>

                      <p className="text-lg font-semibold tabular-nums text-stone-900">
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

      <p className="mt-8 rounded-xl bg-amber-50 px-5 py-4 text-amber-900">
        <strong className="font-semibold">This is what you bought, not
        what is left.</strong>{" "}
        Knowing how much flour remains would mean recording how much goes into
        each bake, which nobody does today (INV-1). These purchases count as a
        cost on the day they were bought, which may not be right if costs should
        be spread across the days a supply is used (CST-3).
      </p>
    </>
  );
}
