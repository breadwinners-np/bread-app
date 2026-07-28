"use client";

import { useActionState, useState } from "react";

import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_OPTIONS,
  formatDate,
  formatGhs,
  pesewasToCedis,
  type Customer,
} from "@bread/shared";

import { createPaymentAction, type FormState } from "@/app/actions";
import { Field, buttonClass, inputClass } from "@/components/ui";
import type { OpenOrderOption } from "@/services/payments";

const INITIAL: FormState = {};

export function PaymentForm({
  customers,
  openOrdersByCustomer,
}: {
  customers: Customer[];
  /** Delivered, unpaid orders for each customer who has any. */
  openOrdersByCustomer: Record<string, OpenOrderOption[]>;
}) {
  const [state, formAction, pending] = useActionState(createPaymentAction, INITIAL);

  const [customerId, setCustomerId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [amount, setAmount] = useState("");

  const openOrders = openOrdersByCustomer[customerId] ?? [];
  const selectedOrder = openOrders.find((order) => order.id === orderId);
  const owed = openOrders.reduce((total, order) => total + order.outstandingPesewas, 0);

  /**
   * Picking an order fills in what it is short by. She can still type over it —
   * a customer paying half of one day's bread is ordinary.
   */
  function chooseOrder(nextOrderId: string) {
    setOrderId(nextOrderId);
    const next = openOrders.find((order) => order.id === nextOrderId);
    setAmount(next ? String(pesewasToCedis(next.outstandingPesewas)) : "");
  }

  return (
    <form action={formAction} className="space-y-6">
      <Field label="Who paid">
        <select
          name="customerId"
          className={inputClass}
          value={customerId}
          onChange={(event) => {
            setCustomerId(event.target.value);
            setOrderId("");
            setAmount("");
          }}
        >
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

      {customerId && (
        <div className="rounded-xl bg-stone-100 px-5 py-4">
          {owed > 0 ? (
            <p className="text-lg">
              Owes{" "}
              <strong className="font-bold tabular-nums">{formatGhs(owed)}</strong>{" "}
              across {openOrders.length}{" "}
              {openOrders.length === 1 ? "delivery" : "deliveries"}.
            </p>
          ) : (
            <p className="text-lg">
              Nothing owed. Anything recorded now sits as credit against their
              next delivery.
            </p>
          )}
        </div>
      )}

      <Field
        label="What is it for"
        hint="Bread that has been delivered but not paid for. Choose 'on the account' for a lump sum like a monthly cheque — it goes against the oldest unpaid delivery first."
      >
        <select
          name="orderId"
          className={inputClass}
          value={orderId}
          onChange={(event) => chooseOrder(event.target.value)}
          disabled={!customerId}
        >
          <option value="">On the account</option>
          {openOrders.map((order) => (
            <option key={order.id} value={order.id}>
              {formatDate(order.deliveryDate)} — {order.quantity} ×{" "}
              {order.productName} — {formatGhs(order.outstandingPesewas)} unpaid
            </option>
          ))}
        </select>
        <FieldError message={state.fieldErrors?.orderId} />
      </Field>

      <Field label="How much" hint="In cedis. For GHS 1,440.00 enter 1440.">
        <input
          type="number"
          name="amountCedis"
          min={0}
          step="0.01"
          placeholder="0.00"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className={`${inputClass} max-w-56`}
        />
        <FieldError message={state.fieldErrors?.amountCedis} />
      </Field>

      {selectedOrder && Number(amount) > 0 && (
        <p className="rounded-xl bg-stone-100 px-5 py-4 text-lg">
          {shortfallNote(selectedOrder.outstandingPesewas, Number(amount) * 100)}
        </p>
      )}

      <Field label="How they paid">
        <select name="method" className={inputClass} defaultValue="cash">
          {PAYMENT_METHOD_OPTIONS.map((method) => (
            <option key={method} value={method}>
              {PAYMENT_METHOD_LABELS[method]}
            </option>
          ))}
        </select>
        <FieldError message={state.fieldErrors?.method} />
      </Field>

      <Field
        label="Cheque number or reference"
        hint="Optional. For a cheque, write the number and the bank."
      >
        <input
          name="reference"
          className={inputClass}
          placeholder="Cheque 004821 — GCB"
        />
      </Field>

      <Field label="Note" hint="Optional.">
        <textarea name="note" rows={2} className={inputClass} />
      </Field>

      {state.error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-red-800">{state.error}</p>
      )}

      <button type="submit" disabled={pending} className={buttonClass("primary")}>
        {pending ? "Saving…" : "Save payment"}
      </button>
    </form>
  );
}

/** Plain-language confirmation of what this payment leaves behind. */
function shortfallNote(outstandingPesewas: number, payingPesewas: number): string {
  const remaining = Math.round(outstandingPesewas - payingPesewas);

  if (remaining > 0) {
    return `That leaves ${formatGhs(remaining)} still owed on this delivery.`;
  }
  if (remaining < 0) {
    return `That is ${formatGhs(-remaining)} more than this delivery costs. The extra goes against their other unpaid bread.`;
  }
  return "That settles this delivery in full.";
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="mt-1 block text-sm text-red-700">{message}</span>;
}
