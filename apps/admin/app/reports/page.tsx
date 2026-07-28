import Link from "next/link";

import {
  COST_CATEGORY_LABELS,
  RANGE_PRESETS,
  formatDate,
  formatGhs,
  matchRangePreset,
  reportRangeSchema,
  resolveRangePreset,
  startOfMonth,
  summariseReport,
  todayIso,
  type CostCategory,
  type DateRange,
} from "@bread/shared";

import {
  MoneyColumnsChart,
  RankedBarsChart,
  type MoneyColumn,
} from "@/components/charts";
import {
  Card,
  PageHeader,
  SectionTitle,
  StatTile,
  buttonClass,
  inputClass,
} from "@/components/ui";
import { getReport } from "@/services/reports";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; preset?: string }>;
}) {
  const { from, to, preset } = await searchParams;
  const today = todayIso();
  const range = rangeFrom({ from, to, preset }, today);

  const report = await getReport(range);
  const activePreset = matchRangePreset(range, today);

  const columns: MoneyColumn[] = report.buckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    revenuePesewas: bucket.revenuePesewas,
    costPesewas: bucket.costPesewas,
  }));

  const periodLabel =
    report.granularity === "day"
      ? "day"
      : report.granularity === "week"
        ? "week"
        : "month";

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={
          range.from === range.to
            ? formatDate(range.from)
            : `${formatDate(range.from)} to ${formatDate(range.to)}`
        }
      />

      {/* One filter row above everything it scopes: every number and every
          chart on this page reads the same stretch of days. */}
      <Card className="mb-8">
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <p className="mb-2 text-base font-semibold text-stone-800">
              Choose the days
            </p>
            <div className="flex flex-wrap gap-2">
              {RANGE_PRESETS.map((option) => (
                <Link
                  key={option.id}
                  href={`/reports?preset=${option.id}`}
                  aria-current={activePreset === option.id ? "true" : undefined}
                  className={
                    activePreset === option.id
                      ? `${buttonClass("primary")} px-4 py-2`
                      : `${buttonClass("secondary")} px-4 py-2`
                  }
                >
                  {option.label}
                </Link>
              ))}
            </div>
          </div>

          <form method="get" className="flex flex-wrap items-end gap-3">
            <div>
              <label
                htmlFor="from"
                className="mb-2 block text-base font-semibold text-stone-800"
              >
                From
              </label>
              <input
                id="from"
                type="date"
                name="from"
                defaultValue={range.from}
                max={today}
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="to"
                className="mb-2 block text-base font-semibold text-stone-800"
              >
                To
              </label>
              <input
                id="to"
                type="date"
                name="to"
                defaultValue={range.to}
                max={today}
                className={inputClass}
              />
            </div>
            <button type="submit" className={buttonClass("secondary")}>
              Show these days
            </button>
          </form>
        </div>
      </Card>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Money earned"
          value={formatGhs(report.revenuePesewas)}
          hint={`${report.quantityDelivered.toLocaleString("en-US")} loaves delivered`}
        />
        <StatTile
          label="Money spent"
          value={formatGhs(report.costPesewas)}
          hint="Gas, ingredients and transport"
        />
        <StatTile
          label="Left over"
          value={formatGhs(report.profitPesewas)}
          hint="Before wages"
        />
        <StatTile
          label="Still unpaid"
          value={formatGhs(report.outstandingPesewas)}
          hint="From bread delivered in these days"
        />
      </div>

      {/* A chart of one column says nothing the tiles above have not already
          said, so a single day skips it. */}
      {columns.length > 1 && (
        <Card className="mb-8">
          <SectionTitle>Money in and out</SectionTitle>
          <MoneyColumnsChart columns={columns} periodLabel={periodLabel} />

          {/* Every value in the chart is also readable as text, so nothing is
              locked behind a hover. */}
          <details className="mt-6">
            <summary className="cursor-pointer font-semibold text-stone-700">
              Show the numbers
            </summary>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-500">
                    <th className="py-2 pr-4 font-medium">Day</th>
                    <th className="py-2 pr-4 text-right font-medium">Earned</th>
                    <th className="py-2 pr-4 text-right font-medium">Spent</th>
                    <th className="py-2 pr-4 text-right font-medium">
                      Left over
                    </th>
                    <th className="py-2 text-right font-medium">Loaves</th>
                  </tr>
                </thead>
                <tbody>
                  {report.buckets.map((bucket) => (
                    <tr key={bucket.key} className="border-b border-stone-100">
                      <td className="py-2 pr-4">{formatDate(bucket.key)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {formatGhs(bucket.revenuePesewas)}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {formatGhs(bucket.costPesewas)}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {formatGhs(bucket.revenuePesewas - bucket.costPesewas)}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {bucket.quantityDelivered}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </Card>
      )}

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>Which bread sold</SectionTitle>
          <RankedBarsChart
            bars={report.byProduct.map((entry) => ({
              key: entry.key,
              label: entry.label,
              valuePesewas: entry.valuePesewas,
              detail: entry.quantity
                ? `${entry.quantity.toLocaleString("en-US")} ${entry.quantity === 1 ? "loaf" : "loaves"}`
                : undefined,
            }))}
            emptyMessage="No bread was delivered in these days."
          />
        </Card>

        <Card>
          <SectionTitle>Where the money went</SectionTitle>
          <RankedBarsChart
            bars={report.byCostCategory.map((entry) => ({
              key: entry.key,
              label: COST_CATEGORY_LABELS[entry.key as CostCategory] ?? entry.label,
              valuePesewas: entry.valuePesewas,
              detail: percentOf(entry.valuePesewas, report.costPesewas),
            }))}
            emptyMessage="Nothing was bought in these days."
          />
        </Card>
      </div>

      <Card className="mb-8">
        <SectionTitle>Who bought the most</SectionTitle>
        <RankedBarsChart
          bars={report.byCustomer.slice(0, 8).map((entry) => ({
            key: entry.key,
            label: entry.label,
            valuePesewas: entry.valuePesewas,
          }))}
          emptyMessage="No deliveries were made in these days."
        />
      </Card>

      <Card className="mb-8 bg-amber-50">
        <SectionTitle>In short</SectionTitle>
        <p className="text-lg leading-relaxed text-stone-800">
          {summariseReport(report, formatGhs).join(" ")}
        </p>
        <p className="mt-4 text-stone-600">
          Money received in these days:{" "}
          <strong className="font-semibold">
            {formatGhs(report.paymentsReceivedPesewas)}
          </strong>
          . That is cash and cheques that came in, which is not the same as what
          was earned — a cheque for last month arrives this month.
        </p>
      </Card>

      <p className="rounded-xl bg-amber-50 px-5 py-4 text-amber-900">
        <strong className="font-semibold">What these numbers assume.</strong>{" "}
        Bread counts as earned on the day it was delivered, and a delivery that
        failed earns nothing (decision 0012). Costs count on the day they were
        bought, which may be wrong if they should be spread across the days a
        supply is used (CST-3), and &ldquo;left over&rdquo; does not subtract
        wages. Cheques count from the day they were recorded, not the day they
        clear (PAY-3). Export to Excel and PDF is not built yet.
      </p>
    </>
  );
}

function percentOf(value: number, total: number): string | undefined {
  if (total <= 0) return undefined;
  return `${Math.round((value / total) * 100)}%`;
}

/**
 * Work out which days to report on, from a preset or a typed pair of dates.
 *
 * Anything unparseable falls back to this month rather than erroring — a
 * mistyped URL should show the owner a report, not a stack trace.
 */
function rangeFrom(
  params: { from?: string; to?: string; preset?: string },
  today: string,
): DateRange {
  if (params.preset) {
    const preset = RANGE_PRESETS.find((entry) => entry.id === params.preset);
    const resolved = preset ? resolveRangePreset(preset.id, today) : null;
    if (resolved) return resolved;
  }

  const parsed = reportRangeSchema.safeParse({
    from: params.from,
    to: params.to,
  });

  if (parsed.success) return parsed.data;

  return { from: startOfMonth(today), to: today };
}
