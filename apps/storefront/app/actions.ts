"use server";

import { randomUUID } from "node:crypto";

import { addDays, checkoutInputSchema, todayIso, type CheckoutInput } from "@bread/shared";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionCustomerId } from "@/lib/session";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface PlacedOrder {
  orderId: string;
  totalPesewas: number;
}

/**
 * Place one basket as one order.
 *
 * It used to write one order per bread type, so a customer who bought butter
 * and brown bread appeared twice on the owner's screen (decision 0023). One
 * basket is now one order carrying several lines — see decision 0026.
 *
 * Who the order belongs to comes from the signed-in session, never from the
 * form. That is what stops a new customer record being created on every
 * checkout, and stops anyone placing an order in somebody else's name.
 */
export async function placeOrder(
  input: CheckoutInput,
): Promise<ActionResult<PlacedOrder>> {
  const customerId = await getSessionCustomerId();
  if (!customerId) {
    return { ok: false, error: "Sign in before placing your order." };
  }

  const parsed = checkoutInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check your details and try again",
    };
  }

  const { deliveryAddress, deliveryDate, deliveryNote, paymentMethod, items } =
    parsed.data;

  // Bread is baked overnight for the morning round, so the earliest a new
  // order can be filled is tomorrow. Checked here as well as in the picker,
  // because the picker is only a suggestion to anyone posting directly.
  if (deliveryDate < addDays(todayIso(), 1)) {
    return {
      ok: false,
      error: "Bread is baked fresh, so the earliest we can deliver is tomorrow.",
    };
  }

  const { data: products, error: productsError } = await supabaseAdmin
    .from("products")
    .select("id, name, price_pesewas, active")
    .in(
      "id",
      items.map((item) => item.productId),
    );

  if (productsError) {
    return { ok: false, error: "Could not load the menu. Try again." };
  }

  const productById = new Map((products ?? []).map((product) => [product.id, product]));

  // Every line is recomputed from the current database price and name. The cart
  // in the browser is a display convenience only — it is never trusted for
  // money (CLAUDE.md: snapshot prices onto order lines, never trust the client).
  const lines = [];
  for (const item of items) {
    const product = productById.get(item.productId);
    if (!product || !product.active) {
      return { ok: false, error: "One of the items in your cart is no longer available." };
    }
    lines.push({
      product_id: product.id,
      product_name: product.name,
      unit_price_pesewas: product.price_pesewas,
      quantity: item.quantity,
    });
  }

  // One call, so the order, all its breads and its delivery record either all
  // exist or none of them do.
  const { data, error } = await supabaseAdmin.rpc("place_order", {
    p_customer_id: customerId,
    p_delivery_date: deliveryDate,
    p_source: "app",
    p_lines: lines,
    p_payment_method: paymentMethod,
    p_payment_status: "pending",
    p_delivery_note: deliveryNote || null,
    p_delivery_address: deliveryAddress,
  });

  if (error || !data) {
    return { ok: false, error: "Could not place the order. Try again." };
  }

  return {
    ok: true,
    data: {
      orderId: data as string,
      totalPesewas: lines.reduce(
        (total, line) => total + line.unit_price_pesewas * line.quantity,
        0,
      ),
    },
  };
}

/**
 * Stands in for Paystack until real keys are wired in.
 *
 * Real integration replaces the body of this function, not its shape: the
 * client opens Paystack Checkout (Inline JS) with the PUBLIC key only, and on
 * its "success" callback calls this same action with the transaction
 * reference. The action then calls Paystack's
 * GET /transaction/verify/:reference from the server, using the SECRET key,
 * and only marks the order paid if Paystack itself confirms the charge. The
 * client's callback firing is never, by itself, treated as proof of payment —
 * that is a well-known way for a demo-grade integration to be spoofed.
 */
export async function confirmMockPayment(
  orderId: string,
  method: "card" | "mobile_money",
): Promise<ActionResult<null>> {
  const customerId = await getSessionCustomerId();
  if (!customerId) {
    return { ok: false, error: "Sign in to pay for this order." };
  }

  if (!orderId) {
    return { ok: false, error: "Missing order" };
  }

  // Confirming a payment marks an order paid, so it has to be this customer's
  // order — an order id is otherwise all anyone would need.
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (!order) {
    return { ok: false, error: "That order is not yours to pay for." };
  }

  // Marks the order paid and records the money in one transaction, behind a
  // guard that only lets the first call through — so a double-clicked button
  // cannot record the same money twice.
  const { error } = await supabaseAdmin.rpc("confirm_order_payment", {
    p_order_id: orderId,
    p_reference: `MOCK-${randomUUID()}`,
    p_method: method,
  });

  if (error) {
    return { ok: false, error: "Could not confirm payment. Try again." };
  }

  return { ok: true, data: null };
}
