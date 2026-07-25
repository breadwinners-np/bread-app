/**
 * Money helpers. All money in this system is Ghana Cedis stored as integer
 * pesewas (decision 0004) — floating point cannot represent decimal currency
 * exactly, and the error compounds across a month of daily deliveries.
 *
 * Formatting happens only at the display edge.
 */

export const PESEWAS_PER_CEDI = 100;

export const CURRENCY_CODE = "GHS";

/** Format pesewas for display, e.g. 123456 -> "GHS 1,234.56". */
export function formatGhs(pesewas: number): string {
  const rounded = Math.round(pesewas);
  const negative = rounded < 0;
  const absolute = Math.abs(rounded);

  const cedis = Math.floor(absolute / PESEWAS_PER_CEDI);
  const remainder = absolute % PESEWAS_PER_CEDI;

  const grouped = cedis.toLocaleString("en-US");
  const decimals = String(remainder).padStart(2, "0");

  return `${negative ? "-" : ""}${CURRENCY_CODE} ${grouped}.${decimals}`;
}

/** Format pesewas without the currency code, e.g. 123456 -> "1,234.56". */
export function formatAmount(pesewas: number): string {
  return formatGhs(pesewas).replace(`${CURRENCY_CODE} `, "");
}

/** Convert a cedi amount typed by a user into integer pesewas. */
export function cedisToPesewas(cedis: number): number {
  return Math.round(cedis * PESEWAS_PER_CEDI);
}

export function pesewasToCedis(pesewas: number): number {
  return pesewas / PESEWAS_PER_CEDI;
}

export function sumPesewas(amounts: readonly number[]): number {
  return amounts.reduce((total, amount) => total + amount, 0);
}
