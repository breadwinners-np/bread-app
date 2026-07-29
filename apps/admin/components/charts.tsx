import { formatGhs } from "@bread/shared";

/**
 * Chart primitives, drawn as plain SVG on the server.
 *
 * No charting library: these are two static forms with no interaction beyond a
 * hover tooltip, and Recharts would mean a client bundle and a new dependency
 * for that. See decision 0014 — if the owner ever wants to brush, zoom, or pick
 * a series, that is the moment to reach for Recharts instead.
 *
 * The two series colours are validated for colour-blind separation against a
 * white surface (ΔE 24.7 under protanopia, well clear of the 8 floor). Do not
 * substitute them by eye. Text never wears a series colour — identity comes
 * from the swatch beside it, so the chart is still readable in greyscale.
 */

const SERIES = {
  /** Money earned. */
  revenue: "#2a78d6",
  /** Money spent. */
  cost: "#eb6834",
  /** Single-hue bars, where length is the only thing being compared. */
  single: "#2a78d6",
} as const;

const INK = {
  muted: "#898781",
  grid: "#e1e0d9",
  axis: "#c3c2b7",
} as const;

/** Axis ticks are whole cedis — pesewas on an axis is noise. */
function cedisTick(pesewas: number): string {
  return Math.round(pesewas / 100).toLocaleString("en-US");
}

/** Round a maximum up to something a person would choose: 200, 500, 1,000. */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const scaled = value / magnitude;
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 2.5 ? 2.5 : scaled <= 5 ? 5 : 10;
  return step * magnitude;
}

/** A bar with its far end rounded and its baseline end square. */
function columnPath(x: number, y: number, width: number, height: number): string {
  const r = Math.min(4, width / 2, height);
  if (height <= 0) return "";
  return [
    `M${x},${y + height}`,
    `V${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `H${x + width - r}`,
    `Q${x + width},${y} ${x + width},${y + r}`,
    `V${y + height}`,
    "Z",
  ].join(" ");
}

function barPath(x: number, y: number, width: number, height: number): string {
  const r = Math.min(4, height / 2, width);
  if (width <= 0) return "";
  return [
    `M${x},${y}`,
    `H${x + width - r}`,
    `Q${x + width},${y} ${x + width},${y + r}`,
    `V${y + height - r}`,
    `Q${x + width},${y + height} ${x + width - r},${y + height}`,
    `H${x}`,
    "Z",
  ].join(" ");
}

export function ChartLegend({
  items,
}: {
  items: { label: string; color: string }[];
}) {
  return (
    <ul className="mb-5 flex flex-wrap gap-5">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2 text-sm text-stone-600">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export interface MoneyColumn {
  key: string;
  label: string;
  revenuePesewas: number;
  costPesewas: number;
}

/**
 * Money in against money out, one pair of columns per day, week, or month.
 *
 * One vertical scale for both series — they are both cedis, so they belong on
 * the same axis and a second scale would invent a relationship that is not in
 * the data.
 */
export function MoneyColumnsChart({
  columns,
  periodLabel,
}: {
  columns: MoneyColumn[];
  periodLabel: string;
}) {
  const width = 760;
  const plotHeight = 260;
  const axisBand = 28;
  const left = 56;
  const right = 12;
  const top = 8;
  const height = top + plotHeight + axisBand;

  const plotWidth = width - left - right;
  const max = niceMax(
    Math.max(
      1,
      ...columns.map((column) => Math.max(column.revenuePesewas, column.costPesewas)),
    ),
  );

  const band = plotWidth / Math.max(columns.length, 1);
  // Two bars per band, a 2px gap between them, and the leftover stays as air.
  const barWidth = Math.max(3, Math.min(14, band / 2 - 3));
  const scale = (pesewas: number) => (pesewas / max) * plotHeight;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => ({
    value: max * fraction,
    y: top + plotHeight - plotHeight * fraction,
  }));

  // With a month of days, a label under every column is unreadable.
  const labelEvery = Math.ceil(columns.length / 10);

  return (
    <figure className="m-0">
      <ChartLegend
        items={[
          { label: "Money earned", color: SERIES.revenue },
          { label: "Money spent", color: SERIES.cost },
        ]}
      />

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Money earned against money spent, by ${periodLabel}. The numbers are listed in the table below the chart.`}
      >
        {ticks.map((tick) => (
          <g key={tick.value}>
            <line
              x1={left}
              x2={width - right}
              y1={tick.y}
              y2={tick.y}
              stroke={tick.value === 0 ? INK.axis : INK.grid}
              strokeWidth={1}
            />
            <text
              x={left - 10}
              y={tick.y + 4}
              textAnchor="end"
              fontSize={12}
              fill={INK.muted}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {cedisTick(tick.value)}
            </text>
          </g>
        ))}

        {columns.map((column, index) => {
          const bandStart = left + band * index;
          const centre = bandStart + band / 2;
          const revenueHeight = scale(column.revenuePesewas);
          const costHeight = scale(column.costPesewas);

          return (
            <g key={column.key}>
              <title>
                {`${column.label} — earned ${formatGhs(column.revenuePesewas)}, spent ${formatGhs(column.costPesewas)}`}
              </title>

              <path
                d={columnPath(
                  centre - barWidth - 1,
                  top + plotHeight - revenueHeight,
                  barWidth,
                  revenueHeight,
                )}
                fill={SERIES.revenue}
              />
              <path
                d={columnPath(
                  centre + 1,
                  top + plotHeight - costHeight,
                  barWidth,
                  costHeight,
                )}
                fill={SERIES.cost}
              />

              {index % labelEvery === 0 && (
                <text
                  x={centre}
                  y={top + plotHeight + 18}
                  textAnchor="middle"
                  fontSize={12}
                  fill={INK.muted}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {column.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <figcaption className="mt-3 text-sm text-stone-500">
        Cedis, by {periodLabel}. Hover a column for the exact amounts.
      </figcaption>
    </figure>
  );
}

export interface RankedBar {
  key: string;
  label: string;
  valuePesewas: number;
  /** Shown beside the money, e.g. "120 loaves". */
  detail?: string;
}

/**
 * Ranked horizontal bars, longest first.
 *
 * One hue for every bar: length already encodes the magnitude, so colouring
 * each bar differently would spend the identity channel on nothing.
 */
export function RankedBarsChart({
  bars,
  emptyMessage = "Nothing to show for these days.",
}: {
  bars: RankedBar[];
  emptyMessage?: string;
}) {
  if (bars.length === 0) {
    return <p className="py-6 text-stone-500">{emptyMessage}</p>;
  }

  const max = Math.max(...bars.map((bar) => bar.valuePesewas), 1);

  return (
    <ul className="space-y-3">
      {bars.map((bar) => {
        const width = 320;
        const height = 14;
        const filled = Math.max(2, (bar.valuePesewas / max) * width);

        return (
          <li key={bar.key} className="grid grid-cols-[10rem_1fr_auto] items-center gap-4">
            <span className="truncate text-stone-700" title={bar.label}>
              {bar.label}
            </span>

            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="h-3.5 w-full"
              preserveAspectRatio="none"
              role="img"
              aria-label={`${bar.label}: ${formatGhs(bar.valuePesewas)}`}
            >
              <path d={barPath(0, 0, filled, height)} fill={SERIES.single} />
            </svg>

            <span className="text-right tabular-nums text-stone-900">
              <span className="font-medium">{formatGhs(bar.valuePesewas)}</span>
              {bar.detail && (
                <span className="ml-2 text-sm text-stone-500">{bar.detail}</span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
