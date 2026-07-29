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

/**
 * Whether a string is a real calendar day in `YYYY-MM-DD` form.
 *
 * The shape test alone is not enough: `2026-02-31` and `2026-13-45` both match
 * the pattern and neither exists. Round-tripping through `Date` is what rules
 * them out, and it also rejects anything JavaScript would silently roll over
 * into the following month.
 *
 * Anything reaching a date helper from a URL or a form should pass through here
 * first.
 */
export function isValidIsoDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;

  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;

  return date.toISOString().slice(0, 10) === iso;
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

/**
 * Shift an ISO `YYYY-MM-DD` by a number of days.
 *
 * Returns the input unchanged if it is not a real date, matching every other
 * helper in this file. Without that guard `.toISOString()` throws RangeError on
 * an Invalid Date, which took down any screen that put an unvalidated date into
 * a "previous day" link.
 */
export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;

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

/** Whole days from one ISO date to another. Negative if `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.round((end - start) / 86_400_000);
}

/** The first day of the month a date falls in. */
export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** The last day of the month a date falls in. */
export function endOfMonth(iso: string): string {
  const date = new Date(`${startOfMonth(iso)}T00:00:00Z`);
  // Same guard as addDays, and for the same reason — this one builds its own
  // string first, so a malformed input reaches Date just as easily.
  if (Number.isNaN(date.getTime())) return iso;

  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  return date.toISOString().slice(0, 10);
}

/** The Monday of the week a date falls in. Weeks run Monday to Sunday. */
export function startOfWeek(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  // getUTCDay() is 0 for Sunday, which is the last day of the week here.
  const offset = (date.getUTCDay() + 6) % 7;
  return addDays(iso, -offset);
}

/** Every day from `from` to `to`, inclusive. Empty if the range is backwards. */
export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  const span = daysBetween(from, to);
  if (span < 0) return days;

  for (let index = 0; index <= span; index += 1) {
    days.push(addDays(from, index));
  }

  return days;
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
