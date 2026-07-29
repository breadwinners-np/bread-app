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
  HowThisWorks,
  PageHeader,
  SectionTitle,
  StatRow,
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
      <Card className="mb-10">
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <p className="mb-2 font-medium text-stone-900">
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
                className="mb-2 block font-medium text-stone-900"
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
                className="mb-2 block font-medium text-stone-900"
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

      <StatRow>
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
          label={report.profitPesewas < 0 ? "Loss" : "Profit"}
          value={formatGhs(report.profitPesewas)}
          hint="Before wages"
        />
        <StatTile
          label="Still unpaid"
          value={formatGhs(report.outstandingPesewas)}
          hint="From bread delivered in these days"
        />
      </StatRow>

      {/* A chart of one column says nothing the tiles above have not already
          said, so a single day skips it. */}
      {columns.length > 1 && (
        <Card className="mb-8">
          <SectionTitle>Money in and out</SectionTitle>
          <div className="mt-5" />
          <MoneyColumnsChart columns={columns} periodLabel={periodLabel} />

          {/* Every value in the chart is also readable as text, so nothing is
              locked behind a hover. */}
          <details className="mt-6">
            <summary className="cursor-pointer text-lg font-semibold text-stone-800 underline underline-offset-4">
              Show the numbers
            </summary>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b-2 border-stone-200 text-stone-700">
                    <th className="py-2 pr-4 font-medium">Day</th>
                    <th className="py-2 pr-4 text-right font-medium">Earned</th>
                    <th className="py-2 pr-4 text-right font-medium">Spent</th>
                    <th className="py-2 pr-4 text-right font-medium">Profit</th>
                    <th className="py-2 text-right font-medium">Loaves</th>
                  </tr>
                </thead>
                {/* Newest day first: she is nearly always looking for what
                    just happened, not what happened three weeks ago. The chart
                    above stays in time order, because a chart that ran
                    backwards would be unreadable. */}
                <tbody>
                  {[...report.buckets].reverse().map((bucket) => (
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
          <div className="mt-5" />
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
          <div className="mt-5" />
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
        <div className="mt-5" />
        <RankedBarsChart
          bars={report.byCustomer.slice(0, 8).map((entry) => ({
            key: entry.key,
            label: entry.label,
            valuePesewas: entry.valuePesewas,
          }))}
          emptyMessage="No deliveries were made in these days."
        />
      </Card>

      <Card className="mb-8">
        <SectionTitle>In short</SectionTitle>
        <p className="mt-3 text-lg leading-relaxed text-stone-800">
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

      <HowThisWorks>
        <p>
          Bread counts as earned{" "}
          <strong className="font-semibold text-stone-900">on the day it reached someone</strong>
          . A delivery that failed earns nothing.
        </p>
        <p>
          Things you buy count on the day you bought them, and{" "}
          <strong className="font-semibold text-stone-900">
            profit here does not take wages out
          </strong>
          . A cheque counts from the day you wrote it down, not the day the bank
          pays it.
        </p>
        <p>Saving a report to Excel or printing it is not built yet.</p>
      </HowThisWorks>
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
