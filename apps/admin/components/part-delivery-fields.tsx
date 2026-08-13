"use client";

import { useState } from "react";

import type { OrderLine } from "@bread/shared";

import { useConfirmGuard } from "@/components/confirm-button";
import { inputClass } from "@/components/ui";

/**
 * "How much did they actually take?", asked one bread at a time.
 *
 * One box for the whole order would have to guess which bread was short, and
 * the breads are not the same price — so the guess would change what the
 * customer owes. A box per bread is the only version of this question that has
 * a correct answer (decision 0026).
 *
 * The confirm button stays held back until at least one loaf is entered. All
 * zeros is "could not deliver", which is its own button with its own
 * consequence; letting it through here would post a submission the server
 * refuses, and she would see a button that appears to do nothing.
 */
export function PartDeliveryFields({ lines }: { lines: readonly OrderLine[] }) {
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(lines.map((line) => [line.id, "0"])),
  );

  const total = Object.values(quantities).reduce(
    (sum, value) => sum + (Number(value) || 0),
    0,
  );

  useConfirmGuard(total >= 1);

  return (
    <div>
      <div className="space-y-3">
        {lines.map((line) => (
          <label key={line.id} className="flex flex-wrap items-center gap-3">
            <span className="min-w-48 font-medium text-stone-900">
              {line.productName}
            </span>
            <input
              type="number"
              name={`delivered[${line.id}]`}
              min={0}
              max={line.quantity}
              required
              value={quantities[line.id] ?? "0"}
              onChange={(event) =>
                setQuantities((current) => ({
                  ...current,
                  [line.id]: event.target.value,
                }))
              }
              className={`${inputClass} max-w-28`}
            />
            <span className="text-stone-600">of {line.quantity}</span>
          </label>
        ))}
      </div>

      <p className="mt-3 text-sm text-stone-600">
        {total >= 1
          ? "They will only be charged for what you enter here."
          : "Put in at least one loaf. If they got nothing at all, use “Could not deliver” instead."}
      </p>
    </div>
  );
}
