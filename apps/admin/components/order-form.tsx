"use client";

import { useActionState } from "react";

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

      <Field label="Bread">
        <select name="productId" className={inputClass} defaultValue="">
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
        <FieldError message={state.fieldErrors?.productId} />
      </Field>

      <Field label="How many">
        <input
          type="number"
          name="quantity"
          min={1}
          defaultValue={1}
          className={`${inputClass} max-w-40`}
        />
        <FieldError message={state.fieldErrors?.quantity} />
      </Field>

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
  return <span className="mt-1 block text-sm text-red-700">{message}</span>;
}
