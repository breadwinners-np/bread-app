"use server";

import { randomUUID } from "node:crypto";

import { addDays, normalisePhone, todayIso } from "@bread/shared";

import { checkoutInputSchema, type CheckoutInput } from "@/lib/schemas";
import { supabaseAdmin } from "@/lib/supabase-admin";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface PlacedOrder {
  /** One order per bread type, so the owner's round reads one bread at a time. */
  orderIds: string[];
  totalPesewas: number;
}

export async function placeOrder(
  input: CheckoutInput,
): Promise<ActionResult<PlacedOrder>> {
  const parsed = checkoutInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check your details and try again",
    };
  }

  const {
    customerName,
    customerPhone,
    deliveryArea,
    deliveryDate,
    deliveryNote,
    paymentMethod,
    items,
  } = parsed.data;

  // Bread is baked overnight for the morning round, so the earliest a new
  // order can be filled is tomorrow. Checked here as well as in the picker,
  // because the picker is only a suggestion to anyone posting directly.
  if (deliveryDate < addDays(todayIso(), 1)) {
    return { ok: false, error: "Bread is baked fresh, so the earliest we can deliver is tomorrow." };
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

  const customerId = await findOrCreateCustomer(customerName, customerPhone, deliveryArea);
  if (!customerId) {
    return { ok: false, error: "Could not save your details. Try again." };
  }

  // One order per bread type: the owner's delivery sheet is written one bread
  // at a time, and a short drop has to be able to say which bread was short
  // (ORD-12 is open, so this deliberately does not create multi-bread orders).
  const orderIds: string[] = [];
  let totalPesewas = 0;

  for (const line of lines) {
    const { data, error } = await supabaseAdmin.rpc("place_order", {
      p_customer_id: customerId,
      p_delivery_date: deliveryDate,
      p_source: "app",
      p_lines: [line],
      p_payment_method: paymentMethod,
      p_payment_status: "pending",
      p_delivery_note: deliveryNote || null,
    });

    if (error || !data) {
      return { ok: false, error: "Could not place the order. Try again." };
    }

    orderIds.push(data as string);
    totalPesewas += line.unit_price_pesewas * line.quantity;
  }

  return { ok: true, data: { orderIds, totalPesewas } };
}

/**
 * Match the caller to an existing customer by phone number, or create one.
 *
 * Deliberately find-then-insert rather than an upsert. A merge-duplicates
 * upsert overwrites every column it is given, which would let someone typing a
 * number that already belongs to a wholesale customer rename them — and change
 * their delivery area — from a public checkout form. An existing customer is
 * matched and left exactly as the owner has them.
 *
 * The race (two orders from the same new number at once) is closed by the
 * unique index on the normalised number: the loser gets 23505 and re-reads the
 * row the winner just wrote, so both end up with the same customer.
 */
async function findOrCreateCustomer(
  name: string,
  phone: string,
  area: string,
): Promise<string | null> {
  const normalised = normalisePhone(phone);

  const existing = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("phone_normalised", normalised)
    .maybeSingle();

  if (existing.data) return existing.data.id as string;

  const created = await supabaseAdmin
    .from("customers")
    .insert({ name, phone, area, type: "individual" })
    .select("id")
    .single();

  if (created.data) return created.data.id as string;

  // Unique violation: someone else created this customer between the two
  // statements above. Their row is as good as ours.
  if (created.error?.code === "23505") {
    const raced = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("phone_normalised", normalised)
      .maybeSingle();

    return (raced.data?.id as string) ?? null;
  }

  return null;
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
  orderIds: string[],
  method: "card" | "mobile_money",
): Promise<ActionResult<null>> {
  if (orderIds.length === 0) {
    return { ok: false, error: "Missing order" };
  }

  const reference = `MOCK-${randomUUID()}`;

  for (const orderId of orderIds) {
    // Marks the order paid and records the money in one transaction, behind a
    // guard that only lets the first call through — so a double-clicked button
    // cannot record the same money twice.
    const { error } = await supabaseAdmin.rpc("confirm_order_payment", {
      p_order_id: orderId,
      p_reference: reference,
      p_method: method,
    });

    if (error) {
      return { ok: false, error: "Could not confirm payment. Try again." };
    }
  }

  return { ok: true, data: null };
}
