"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { addDays, formatGhs, todayIso } from "@bread/shared";

import { useCart } from "@/lib/cart-context";
import { confirmMockPayment, placeOrder } from "../actions";

type PaymentMethod = "card" | "mobile_money";
type Step = "cart" | "paying" | "confirming";

export default function CheckoutPage() {
  const router = useRouter();
  const { lines, setQuantity, removeFromCart, totalPesewas, clearCart } = useCart();

  // Bread is baked overnight for the morning round, so tomorrow is the
  // earliest it can arrive. The server checks this too.
  const earliestDay = addDays(todayIso(), 1);

  const [step, setStep] = useState<Step>("cart");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryArea, setDeliveryArea] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(earliestDay);
  const [deliveryNote, setDeliveryNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("mobile_money");
  const [error, setError] = useState<string | null>(null);
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function handlePlaceOrder() {
    setError(null);
    setBusy(true);
    try {
      const result = await placeOrder({
        customerName,
        customerPhone,
        deliveryArea,
        deliveryDate,
        deliveryNote: deliveryNote || undefined,
        paymentMethod,
        items: lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setOrderIds(result.data.orderIds);
      setStep("paying");
    } finally {
      setBusy(false);
    }
  }

  async function handleMockPay() {
    if (orderIds.length === 0) return;
    setError(null);
    setBusy(true);
    setStep("confirming");
    try {
      // Simulates the round trip to Paystack's popup so the flow feels real.
      await new Promise((resolve) => setTimeout(resolve, 900));

      const result = await confirmMockPayment(orderIds, paymentMethod);
      if (!result.ok) {
        setError(result.error);
        setStep("paying");
        return;
      }

      clearCart();
      router.push(`/order/${orderIds[0]}`);
    } finally {
      setBusy(false);
    }
  }

  if (lines.length === 0 && step === "cart") {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-stone-900">Your cart is empty</h1>
        <p className="text-stone-600">Add some bread from the menu first.</p>
      </div>
    );
  }

  if (step !== "cart") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-stone-900">Pay for your order</h1>
        <div className="rounded-2xl border border-stone-200 bg-white p-6">
          <p className="text-stone-600">Amount due</p>
          <p className="text-3xl font-semibold text-stone-900">{formatGhs(totalPesewas)}</p>
          <p className="mt-2 text-sm text-stone-500">
            Paying with {paymentMethod === "card" ? "card" : "mobile money"} — demo only, nothing is charged.
          </p>
        </div>

        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        <button
          type="button"
          onClick={handleMockPay}
          disabled={busy}
          className="w-full rounded-full bg-amber-700 px-4 py-3 text-base font-medium text-white hover:bg-amber-800 disabled:opacity-60"
        >
          {step === "confirming" ? "Confirming payment…" : `Simulate ${formatGhs(totalPesewas)} payment`}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-stone-900">Checkout</h1>

      <section className="space-y-3">
        {lines.map((line) => (
          <div
            key={line.productId}
            className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-4"
          >
            <div>
              <p className="font-medium text-stone-900">{line.name}</p>
              <p className="text-sm text-stone-600">{formatGhs(line.unitPricePesewas)} each</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label={`Decrease ${line.name} quantity`}
                onClick={() => setQuantity(line.productId, line.quantity - 1)}
                className="h-9 w-9 rounded-full border border-stone-300 text-lg leading-none"
              >
                −
              </button>
              <span className="w-6 text-center">{line.quantity}</span>
              <button
                type="button"
                aria-label={`Increase ${line.name} quantity`}
                onClick={() => setQuantity(line.productId, line.quantity + 1)}
                className="h-9 w-9 rounded-full border border-stone-300 text-lg leading-none"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => removeFromCart(line.productId)}
                className="ml-2 text-sm text-stone-500 underline"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        <div className="flex justify-between border-t border-stone-200 pt-3 text-lg font-semibold text-stone-900">
          <span>Total</span>
          <span>{formatGhs(totalPesewas)}</span>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6">
        <div>
          <label htmlFor="customerName" className="mb-1 block text-sm font-medium text-stone-700">
            Your name
          </label>
          <input
            id="customerName"
            type="text"
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="customerPhone" className="mb-1 block text-sm font-medium text-stone-700">
            Phone number
          </label>
          <input
            id="customerPhone"
            type="tel"
            value={customerPhone}
            onChange={(event) => setCustomerPhone(event.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="deliveryArea" className="mb-1 block text-sm font-medium text-stone-700">
            Where should we bring it?
          </label>
          <input
            id="deliveryArea"
            type="text"
            value={deliveryArea}
            onChange={(event) => setDeliveryArea(event.target.value)}
            placeholder="Area or landmark, e.g. East Legon"
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="deliveryDate" className="mb-1 block text-sm font-medium text-stone-700">
            Which day?
          </label>
          <input
            id="deliveryDate"
            type="date"
            min={earliestDay}
            value={deliveryDate}
            onChange={(event) => setDeliveryDate(event.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
          <p className="mt-1 text-sm text-stone-500">
            Bread is baked fresh overnight, so the earliest is tomorrow.
          </p>
        </div>
        <div>
          <label htmlFor="deliveryNote" className="mb-1 block text-sm font-medium text-stone-700">
            Anything else? (optional)
          </label>
          <textarea
            id="deliveryNote"
            value={deliveryNote}
            onChange={(event) => setDeliveryNote(event.target.value)}
            rows={2}
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </div>
        <fieldset>
          <legend className="mb-1 block text-sm font-medium text-stone-700">Pay with</legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="paymentMethod"
                checked={paymentMethod === "mobile_money"}
                onChange={() => setPaymentMethod("mobile_money")}
              />
              Mobile money
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="paymentMethod"
                checked={paymentMethod === "card"}
                onChange={() => setPaymentMethod("card")}
              />
              Card
            </label>
          </div>
        </fieldset>
      </section>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <button
        type="button"
        onClick={handlePlaceOrder}
        disabled={busy}
        className="w-full rounded-full bg-stone-900 px-4 py-3 text-base font-medium text-white disabled:opacity-60"
      >
        {busy ? "Placing order…" : `Place order — ${formatGhs(totalPesewas)}`}
      </button>
    </div>
  );
}
