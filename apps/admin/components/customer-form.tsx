"use client";

import { useActionState } from "react";

import { CUSTOMER_TYPE_LABELS, CUSTOMER_TYPE_OPTIONS } from "@bread/shared";

import { createCustomerAction, type FormState } from "@/app/actions";
import { Field, buttonClass, inputClass } from "@/components/ui";

const INITIAL: FormState = {};

export function CustomerForm() {
  const [state, formAction, pending] = useActionState(
    createCustomerAction,
    INITIAL,
  );

  return (
    <form action={formAction} className="space-y-6">
      <Field label="Name">
        <input name="name" className={inputClass} placeholder="Baatsonaa Total" />
        <FieldError message={state.fieldErrors?.name} />
      </Field>

      <Field label="Phone number">
        <input name="phone" className={inputClass} placeholder="+233 24 000 0000" />
        <FieldError message={state.fieldErrors?.phone} />
      </Field>

      <Field
        label="Type of customer"
        hint="Business customers agree a quantity for the month. Individuals buy as they go."
      >
        <select name="type" className={inputClass} defaultValue="individual">
          {CUSTOMER_TYPE_OPTIONS.map((type) => (
            <option key={type} value={type}>
              {CUSTOMER_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
        <FieldError message={state.fieldErrors?.type} />
      </Field>

      <Field label="Delivery area">
        <input name="area" className={inputClass} placeholder="Osu" />
        <FieldError message={state.fieldErrors?.area} />
      </Field>

      <Field label="Notes" hint="Anything the driver or you should remember.">
        <textarea name="notes" rows={3} className={inputClass} />
      </Field>

      {state.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={buttonClass("primary")}>
        {pending ? "Saving…" : "Save customer"}
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
