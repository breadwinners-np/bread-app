import Link from "next/link";

import {
  WEEKDAY_SHORT_NAMES,
  addMonths,
  calendarWeeks,
  dayOfMonth,
  formatMonth,
  monthOf,
} from "@bread/shared";

import { ButtonLink } from "@/components/ui";

/**
 * A month grid, used by both Orders and Deliveries.
 *
 * A real table rather than a grid of divs: a calendar *is* tabular data, and the
 * weekday headers only mean something to a screen reader if they are `<th>`s.
 *
 * The component knows nothing about bread. Each screen decides what a day
 * summarises to and where tapping it goes, which is what lets one calendar
 * serve two screens that count different things.
 */

export interface CalendarCell {
  /** ISO `YYYY-MM-DD`. */
  date: string;
  /** Where tapping the day goes. A day with nothing on it passes null. */
  href: string | null;
  /** The headline for the day, e.g. "3 orders". Null leaves the day blank. */
  primary: string | null;
  /** A quieter second line, e.g. "130 loaves". */
  secondary?: string | null;
  /**
   * Colours a dot beside the summary. Never the only signal — the text says
   * the same thing, because a dot alone is unreadable to a third of people
   * with colour blindness and to anyone printing in black and white.
   */
  tone?: "good" | "warn" | "bad" | "neutral";
}

const TONE_DOTS = {
  good: "bg-green-600",
  warn: "bg-amber-500",
  bad: "bg-red-600",
  neutral: "bg-stone-400",
} as const;

export function MonthCalendar({
  month,
  cells,
  today,
  /** `/orders` or `/distribution` — the month arrows keep the current view. */
  basePath,
  /** Extra query kept on the month arrows, e.g. `view=calendar`. */
  baseQuery,
}: {
  month: string;
  cells: Record<string, CalendarCell>;
  today: string;
  basePath: string;
  baseQuery?: string;
}) {
  const weeks = calendarWeeks(month);
  const query = baseQuery ? `${baseQuery}&` : "";

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-stone-900">
          {formatMonth(month)}
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink
            href={`${basePath}?${query}month=${addMonths(month, -1)}`}
            variant="secondary"
          >
            ← {formatMonth(addMonths(month, -1))}
          </ButtonLink>
          {month !== monthOf(today) && (
            <ButtonLink href={`${basePath}?${query}month=${monthOf(today)}`} variant="secondary">
              This month
            </ButtonLink>
          )}
          <ButtonLink
            href={`${basePath}?${query}month=${addMonths(month, 1)}`}
            variant="secondary"
          >
            {formatMonth(addMonths(month, 1))} →
          </ButtonLink>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] table-fixed border-collapse">
          <caption className="sr-only">
            {formatMonth(month)}, one cell per day. Days with bread on them link
            to that day.
          </caption>
          <thead>
            <tr>
              {WEEKDAY_SHORT_NAMES.map((name) => (
                <th
                  key={name}
                  scope="col"
                  className="border-b border-stone-200 pb-2 text-left text-sm font-medium uppercase tracking-wide text-stone-500"
                >
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week[0]?.date}>
                {week.map((day) => {
                  const cell = cells[day.date];
                  const isToday = day.date === today;

                  return (
                    <td
                      key={day.date}
                      className="h-24 border-b border-r border-stone-100 align-top first:border-l-0 last:border-r-0"
                    >
                      <DayCell
                        cell={cell}
                        date={day.date}
                        inMonth={day.inMonth}
                        isToday={isToday}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DayCell({
  cell,
  date,
  inMonth,
  isToday,
}: {
  cell: CalendarCell | undefined;
  date: string;
  inMonth: boolean;
  isToday: boolean;
}) {
  const number = (
    <span
      className={[
        "inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-sm tabular-nums",
        isToday
          ? "bg-stone-900 font-semibold text-white"
          : inMonth
            ? "font-medium text-stone-700"
            : "text-stone-400",
      ].join(" ")}
    >
      {dayOfMonth(date)}
    </span>
  );

  const body =
    cell?.primary == null ? null : (
      <div className="mt-1.5">
        <p className="flex items-center gap-1.5 font-medium text-stone-900">
          {cell.tone && (
            <span
              aria-hidden
              className={`inline-block h-2 w-2 shrink-0 rounded-full ${TONE_DOTS[cell.tone]}`}
            />
          )}
          <span className="truncate">{cell.primary}</span>
        </p>
        {cell.secondary && (
          <p className="truncate text-sm text-stone-500">{cell.secondary}</p>
        )}
      </div>
    );

  const content = (
    <>
      <div className="flex items-start justify-between">
        {number}
        {isToday && <span className="sr-only">Today</span>}
      </div>
      {body}
    </>
  );

  if (!cell?.href) {
    return (
      <div className={`h-full p-2 ${inMonth ? "" : "bg-stone-50/60"}`}>
        {content}
      </div>
    );
  }

  return (
    <Link
      href={cell.href}
      className="block h-full p-2 transition-colors hover:bg-stone-50 focus-visible:bg-stone-50"
    >
      {content}
    </Link>
  );
}
