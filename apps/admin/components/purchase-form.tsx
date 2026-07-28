"use client";

import { useActionState, useState } from "react";

import {
  UNIT_LABELS,
  UNIT_OPTIONS,
  formatGhs,
  type SupplyItem,
} from "@bread/shared";

import { createPurchaseAction, type FormState } from "@/app/actions";
import { Field, buttonClass, inputClass } from "@/components/ui";

const INITIAL: FormState = {};

export function PurchaseForm({
  items,
  defaultDate,
}: {
  items: SupplyItem[];
  defaultDate: string;
}) {
  const [state, formAction, pending] = useActionState(
    createPurchaseAction,
    INITIAL,
  );

  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");

  const selected = items.find((item) => item.id === itemId);

  // Shown live so the owner can catch a typo before saving, not after.
  const total =
    Number(quantity) > 0 && Number(unitPrice) > 0
      ? Math.round(Number(quantity) * Number(unitPrice) * 100)
      : null;

  return (
    <form action={formAction} className="space-y-6">
      <Field label="What did you buy?">
        <select
          name="itemId"
          className={inputClass}
          value={itemId}
          onChange={(event) => setItemId(event.target.value)}
        >
          <option value="" disabled>
            Choose an item
          </option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <FieldError message={state.fieldErrors?.itemId} />
      </Field>

      <Field label="Day you bought it">
        <input
          type="date"
          name="date"
          defaultValue={defaultDate}
          className={inputClass}
        />
        <FieldError message={state.fieldErrors?.date} />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="How much">
          <input
            type="number"
            name="quantity"
            min={0}
            step="any"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className={inputClass}
          />
          <FieldError message={state.fieldErrors?.quantity} />
        </Field>

        <Field label="Measured in">
          <select
            name="unit"
            className={inputClass}
            key={selected?.defaultUnit ?? "none"}
            defaultValue={selected?.defaultUnit ?? "sack"}
          >
            {UNIT_OPTIONS.map((unit) => (
              <option key={unit} value={unit}>
                {UNIT_LABELS[unit].many}
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.unit} />
        </Field>
      </div>

      <Field
        label="Price for one"
        hint="In cedis. For 4 sacks at GHS 300 each, enter 300."
      >
        <input
          type="number"
          name="unitPriceCedis"
          min={0}
          step="0.01"
          placeholder="300.00"
          value={unitPrice}
          onChange={(event) => setUnitPrice(event.target.value)}
          className={`${inputClass} max-w-56`}
        />
        <FieldError message={state.fieldErrors?.unitPriceCedis} />
      </Field>

      {total !== null && (
        <p className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-stone-700">
          Total spent:{" "}
          <strong className="font-semibold tabular-nums text-stone-900">
            {formatGhs(total)}
          </strong>
        </p>
      )}

      <Field label="Who you bought from" hint="Optional.">
        <input name="supplier" className={inputClass} placeholder="Kwame's Mill" />
      </Field>

      <Field label="Note" hint="Optional.">
        <textarea name="note" rows={2} className={inputClass} />
      </Field>

      {state.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={buttonClass("primary")}>
        {pending ? "Saving…" : "Save purchase"}
      </button>
    </form>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span className="mt-1.5 block text-sm font-medium text-red-700">
      {message}
    </span>
  );
}
