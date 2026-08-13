"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { addDays, formatGhs, todayIso, type Customer } from "@bread/shared";

import { confirmMockPayment, placeOrder } from "@/app/actions";
import { useCart } from "@/lib/cart-context";

type PaymentMethod = "card" | "mobile_money";
type Step = "cart" | "paying" | "confirming";

const inputClass = "w-full rounded-lg border border-stone-300 px-3 py-2";

export function CheckoutForm({ customer }: { customer: Customer }) {
  const router = useRouter();
  const { lines, setQuantity, removeFromCart, totalPesewas, clearCart } = useCart();

  // Bread is baked overnight for the morning round, so tomorrow is the
  // earliest it can arrive. The server checks this too.
  const earliestDay = addDays(todayIso(), 1);
  const homeAddress = customer.address?.trim() ?? "";

  const [step, setStep] = useState<Step>("cart");
  // Where it goes is asked, never assumed: plenty of orders are sent to an
  // office, a church or a relative rather than to the person paying.
  const [sendElsewhere, setSendElsewhere] = useState(homeAddress.length === 0);
  const [otherAddress, setOtherAddress] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(earliestDay);
  const [deliveryNote, setDeliveryNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("mobile_money");
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const deliveryAddress = sendElsewhere ? otherAddress : homeAddress;

  async function handlePlaceOrder() {
    setError(null);
    setBusy(true);
    try {
      const result = await placeOrder({
        deliveryAddress,
        deliveryDate,
        deliveryNote: deliveryNote || undefined,
        paymentMethod,
        items: lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
        })),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setOrderId(result.data.orderId);
      setStep("paying");
    } finally {
      setBusy(false);
    }
  }

  async function handleMockPay() {
    if (!orderId) return;
    setError(null);
    setBusy(true);
    setStep("confirming");
    try {
      const result = await confirmMockPayment(orderId, paymentMethod);
      if (!result.ok) {
        setError(result.error);
        setStep("paying");
        return;
      }

      clearCart();
      router.push(`/order/${orderId}`);
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
            Paying with {paymentMethod === "card" ? "card" : "mobile money"} — demo
            only, nothing is charged.
          </p>
        </div>

        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        <button
          type="button"
          onClick={handleMockPay}
          disabled={busy}
          className="w-full rounded-full bg-amber-700 px-4 py-3 text-base font-medium text-white hover:bg-amber-800 disabled:opacity-60"
        >
          {step === "confirming"
            ? "Confirming payment…"
            : `Simulate ${formatGhs(totalPesewas)} payment`}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Checkout</h1>
        <p className="mt-1 text-stone-600">
          Ordering as {customer.name} · {customer.phone}
        </p>
      </div>

      <section className="space-y-3">
        {lines.map((cartLine) => (
          <div
            key={cartLine.productId}
            className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-4"
          >
            <div>
              <p className="font-medium text-stone-900">{cartLine.name}</p>
              <p className="text-sm text-stone-600">
                {formatGhs(cartLine.unitPricePesewas)} each
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label={`Decrease ${cartLine.name} quantity`}
                onClick={() => setQuantity(cartLine.productId, cartLine.quantity - 1)}
                className="h-9 w-9 rounded-full border border-stone-300 text-lg leading-none"
              >
                −
              </button>
              <span className="w-6 text-center">{cartLine.quantity}</span>
              <button
                type="button"
                aria-label={`Increase ${cartLine.name} quantity`}
                onClick={() => setQuantity(cartLine.productId, cartLine.quantity + 1)}
                className="h-9 w-9 rounded-full border border-stone-300 text-lg leading-none"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => removeFromCart(cartLine.productId)}
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
        <p className="text-sm text-stone-500">
          This is one order with {lines.length}{" "}
          {lines.length === 1 ? "kind of bread" : "kinds of bread"} on it.
        </p>
      </section>

      <section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6">
        <fieldset>
          <legend className="mb-2 block font-medium text-stone-900">
            Where should we bring it?
          </legend>

          {homeAddress && (
            <label className="flex items-start gap-2 py-1">
              <input
                type="radio"
                name="deliveryTarget"
                className="mt-1.5"
                checked={!sendElsewhere}
                onChange={() => setSendElsewhere(false)}
              />
              <span>
                <span className="block text-stone-900">My address</span>
                <span className="block text-sm text-stone-500">{homeAddress}</span>
              </span>
            </label>
          )}

          <label className="flex items-start gap-2 py-1">
            <input
              type="radio"
              name="deliveryTarget"
              className="mt-1.5"
              checked={sendElsewhere}
              onChange={() => setSendElsewhere(true)}
            />
            <span className="text-stone-900">Somewhere else</span>
          </label>

          {sendElsewhere && (
            <textarea
              value={otherAddress}
              onChange={(event) => setOtherAddress(event.target.value)}
              rows={2}
              placeholder="Where should the bread go? House, street or a landmark."
              aria-label="Delivery address"
              className={`${inputClass} mt-2`}
            />
          )}
        </fieldset>

        <div>
          <label htmlFor="deliveryDate" className="mb-1 block font-medium text-stone-900">
            Which day?
          </label>
          <input
            id="deliveryDate"
            type="date"
            min={earliestDay}
            value={deliveryDate}
            onChange={(event) => setDeliveryDate(event.target.value)}
            className={inputClass}
          />
          <p className="mt-1 text-sm text-stone-500">
            Bread is baked fresh overnight, so the earliest is tomorrow.
          </p>
        </div>

        <div>
          <label htmlFor="deliveryNote" className="mb-1 block font-medium text-stone-900">
            Anything else? (optional)
          </label>
          <textarea
            id="deliveryNote"
            value={deliveryNote}
            onChange={(event) => setDeliveryNote(event.target.value)}
            rows={2}
            className={inputClass}
          />
        </div>

        <fieldset>
          <legend className="mb-1 block font-medium text-stone-900">Pay with</legend>
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
        disabled={busy || deliveryAddress.trim().length === 0}
        className="w-full rounded-full bg-stone-900 px-4 py-3 text-base font-medium text-white disabled:opacity-60"
      >
        {busy ? "Placing order…" : `Place order — ${formatGhs(totalPesewas)}`}
      </button>
    </div>
  );
}
