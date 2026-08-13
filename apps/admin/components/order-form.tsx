"use client";

import { useActionState, useRef, useState } from "react";

import {
  CUSTOMER_TYPE_LABELS,
  CUSTOMER_TYPE_OPTIONS,
  formatGhs,
  type Customer,
  type Product,
} from "@bread/shared";

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

  // A customer who phones in for the first time should not send her to another
  // screen and lose the order she is halfway through writing down.
  const [addingCustomer, setAddingCustomer] = useState(customers.length === 0);

  // Stable keys, so removing the first row does not make React reuse its
  // <select> for the second and shuffle what she picked.
  const nextRow = useRef(1);
  const [rows, setRows] = useState<number[]>([0]);

  return (
    <form action={formAction} className="space-y-6">
      <Field label="Customer">
        {addingCustomer ? (
          <div className="space-y-4 rounded-lg border border-stone-300 bg-stone-50 p-4">
            <input type="hidden" name="newCustomer" value="yes" />

            <Field label="Their name">
              <input type="text" name="newCustomerName" className={inputClass} />
              <FieldError message={state.fieldErrors?.name} />
            </Field>

            <Field label="Phone number">
              <input type="tel" name="newCustomerPhone" className={inputClass} />
              <FieldError message={state.fieldErrors?.phone} />
            </Field>

            <Field label="Delivery area">
              <input type="text" name="newCustomerArea" className={inputClass} />
              <FieldError message={state.fieldErrors?.area} />
            </Field>

            <Field label="Business or individual">
              <select name="newCustomerType" className={inputClass} defaultValue="individual">
                {CUSTOMER_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {CUSTOMER_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </Field>

            {customers.length > 0 && (
              <button
                type="button"
                onClick={() => setAddingCustomer(false)}
                className={buttonClass("secondary")}
              >
                Choose an existing customer instead
              </button>
            )}
          </div>
        ) : (
          <>
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
            <button
              type="button"
              onClick={() => setAddingCustomer(true)}
              className="mt-3 block text-stone-600 underline"
            >
              This is a new customer
            </button>
          </>
        )}
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

      {/*
        One order, however many breads. A customer who rings up asking for
        butter bread and brown bread is one order (decision 0026), the same as
        a basket placed online — so she never has to write the same person down
        twice.
      */}
      <fieldset>
        <legend className="block font-medium text-stone-900">Bread</legend>

        <div className="mt-2 space-y-3">
          {rows.map((row, index) => (
            <div key={row} className="flex flex-wrap items-center gap-3">
              <select
                name="productId"
                className={`${inputClass} max-w-xs`}
                defaultValue=""
                aria-label={`Bread ${index + 1}`}
              >
                <option value="" disabled>
                  Choose the bread
                </option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} — {formatGhs(product.pricePesewas)} per{" "}
                    {product.unit}
                  </option>
                ))}
              </select>

              <input
                type="number"
                name="quantity"
                min={1}
                defaultValue={1}
                aria-label={`How many of bread ${index + 1}`}
                className={`${inputClass} max-w-28`}
              />

              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => setRows(rows.filter((entry) => entry !== row))}
                  className="text-stone-600 underline"
                >
                  Take off
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Every problem with the breads — a missing one, a bad number, the
            same bread twice — arrives under "lines". */}
        <FieldError message={state.fieldErrors?.lines} />

        <button
          type="button"
          onClick={() => setRows([...rows, nextRow.current++])}
          className="mt-3 block text-stone-600 underline"
        >
          Add another bread
        </button>
      </fieldset>

      <Field
        label="Where should it go?"
        hint="Leave empty to take it to their usual place."
      >
        <input name="deliveryAddress" className={inputClass} />
        <FieldError message={state.fieldErrors?.deliveryAddress} />
      </Field>

      {state.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
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
  return (
    <span className="mt-1.5 block text-sm font-medium text-red-700">
      {message}
    </span>
  );
}
