"use client";

import { useActionState, useState } from "react";

import { formatGhs, type Customer, type Product } from "@bread/shared";

import { createOrderAction, type FormState } from "@/app/actions";
import { Field, buttonClass, inputClass } from "@/components/ui";

const INITIAL: FormState = {};

export function OrderForm({
  customers,
  products,
  defaultDate,
}: {
  customers: Customer[];
  products: Product[];
  defaultDate: string;
}) {
  const [state, formAction, pending] = useActionState(
    createOrderAction,
    INITIAL,
  );

  // A quantity per kind of bread. With four kinds, showing them all beats
  // making the owner add rows one at a time.
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  const total = products.reduce((sum, product) => {
    const quantity = Number(quantities[product.id] ?? 0);
    return quantity > 0 ? sum + quantity * product.pricePesewas : sum;
  }, 0);

  const chosen = products.filter(
    (product) => Number(quantities[product.id] ?? 0) > 0,
  );

  return (
    <form action={formAction} className="space-y-6">
      <Field label="Customer">
        <select name="customerId" className={inputClass} defaultValue="">
          <option value="" disabled>
            Choose a customer
          </option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name} — {customer.area}
            </option>
          ))}
        </select>
        <FieldError message={state.fieldErrors?.customerId} />
      </Field>

      <Field label="Delivery day" hint="Bread is baked and delivered fresh each day.">
        <input
          type="date"
          name="deliveryDate"
          defaultValue={defaultDate}
          className={inputClass}
        />
        <FieldError message={state.fieldErrors?.deliveryDate} />
      </Field>

      <fieldset>
        <legend className="mb-2 block text-base font-semibold text-stone-800">
          How much of each bread?
        </legend>
        <p className="mb-4 text-sm text-stone-500">
          Leave a bread blank if it is not part of this order.
        </p>

        <div className="space-y-3">
          {products.map((product) => {
            const quantity = Number(quantities[product.id] ?? 0);
            const lineTotal = quantity > 0 ? quantity * product.pricePesewas : 0;

            return (
              <div
                key={product.id}
                className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border px-4 py-3 ${
                  quantity > 0
                    ? "border-amber-300 bg-amber-50"
                    : "border-stone-200 bg-white"
                }`}
              >
                <label htmlFor={`qty-${product.id}`} className="flex-1">
                  <span className="block text-lg font-semibold text-stone-900">
                    {product.name}
                  </span>
                  <span className="text-stone-500">
                    {formatGhs(product.pricePesewas)} per {product.unit}
                  </span>
                </label>

                <div className="flex items-center gap-3">
                  {lineTotal > 0 && (
                    <span className="tabular-nums font-semibold text-stone-700">
                      {formatGhs(lineTotal)}
                    </span>
                  )}
                  <input
                    id={`qty-${product.id}`}
                    name={`qty-${product.id}`}
                    type="number"
                    min={0}
                    step={1}
                    placeholder="0"
                    value={quantities[product.id] ?? ""}
                    onChange={(event) =>
                      setQuantities((current) => ({
                        ...current,
                        [product.id]: event.target.value,
                      }))
                    }
                    className={`${inputClass} w-28`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <FieldError message={state.fieldErrors?.lines} />
      </fieldset>

      {chosen.length > 0 && (
        <p className="rounded-xl bg-stone-100 px-5 py-4 text-lg">
          {chosen.length} {chosen.length === 1 ? "bread" : "breads"} ·{" "}
          <strong className="font-bold tabular-nums">{formatGhs(total)}</strong>
        </p>
      )}

      {state.error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-red-800">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={buttonClass("primary")}>
        {pending ? "Saving…" : "Save order"}
      </button>
    </form>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="mt-2 block text-sm text-red-700">{message}</span>;
}
