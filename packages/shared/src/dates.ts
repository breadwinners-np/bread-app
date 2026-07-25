/**
 * Date helpers.
 *
 * Accra is UTC+0 year round with no daylight saving, so the UTC calendar day
 * and the local business day are the same. That lets us treat an ISO
 * `YYYY-MM-DD` string as the business day without timezone conversion. If this
 * system ever runs outside Ghana, this assumption has to be revisited.
 *
 * Dates display as DD/MM/YYYY.
 */

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Today's business day as ISO `YYYY-MM-DD`. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Format an ISO `YYYY-MM-DD` as `DD/MM/YYYY`. */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

/** Format an ISO `YYYY-MM-DD` as e.g. `Friday, 25 July 2026`. */
export function formatLongDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;

  const dayName = DAY_NAMES[date.getUTCDay()];
  const monthName = MONTH_NAMES[date.getUTCMonth()];

  return `${dayName}, ${date.getUTCDate()} ${monthName} ${date.getUTCFullYear()}`;
}

/** Shift an ISO `YYYY-MM-DD` by a number of days. */
export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** A human label for a date relative to today: Today, Tomorrow, Yesterday. */
export function relativeDayLabel(iso: string, today = todayIso()): string | null {
  if (iso === today) return "Today";
  if (iso === addDays(today, 1)) return "Tomorrow";
  if (iso === addDays(today, -1)) return "Yesterday";
  return null;
}

/** The ISO `YYYY-MM` a date falls in. */
export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

/** Format an ISO `YYYY-MM` as e.g. `July 2026`. */
export function formatMonth(isoMonth: string): string {
  const [year, month] = isoMonth.split("-");
  if (!year || !month) return isoMonth;
  const monthName = MONTH_NAMES[Number(month) - 1];
  return monthName ? `${monthName} ${year}` : isoMonth;
}
