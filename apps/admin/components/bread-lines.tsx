import type { DeliveryLineDetail, OrderLineDetail } from "@bread/shared";

/**
 * The kinds of bread on an order, e.g. "120 × Sugar bread · 40 × Brown bread".
 *
 * An order can carry any mix of sugar, butter, mixfruit and brown, so every
 * line is always shown — never just the first.
 */
export function BreadLines({ lines }: { lines: OrderLineDetail[] }) {
  return (
    <span className="text-stone-600">
      {lines.map((line, index) => (
        <span key={line.lineId}>
          {index > 0 && <span className="text-stone-400"> · </span>}
          <span className="font-medium text-stone-800">{line.quantity}</span> ×{" "}
          {line.productName}
        </span>
      ))}
    </span>
  );
}

/**
 * The same, but showing what arrived against what was due, so a short drop
 * makes it obvious which bread was missing.
 */
export function DeliveredBreadLines({
  lines,
  showDelivered,
}: {
  lines: DeliveryLineDetail[];
  showDelivered: boolean;
}) {
  return (
    <ul className="space-y-1">
      {lines.map((line) => {
        const short = line.deliveredQuantity < line.quantity;

        return (
          <li key={line.lineId} className="flex items-baseline gap-2">
            <span className="text-lg font-semibold tabular-nums text-stone-900">
              {line.quantity}
            </span>
            <span className="text-lg text-stone-700">× {line.productName}</span>

            {showDelivered && (
              <span
                className={`text-base font-medium ${
                  short ? "text-amber-800" : "text-green-700"
                }`}
              >
                {short
                  ? `— only ${line.deliveredQuantity} delivered`
                  : "— delivered"}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
