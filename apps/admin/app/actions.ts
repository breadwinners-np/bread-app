"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  customerInputSchema,
  orderInputSchema,
  paymentDecisionSchema,
  paymentInputSchema,
  purchaseInputSchema,
  recordDeliverySchema,
  rescheduleDeliverySchema,
} from "@bread/shared";

import { createCustomer } from "@/services/customers";
import { recordDelivery, rescheduleDelivery } from "@/services/deliveries";
import { createPurchase } from "@/services/inventory";
import { createOrder } from "@/services/orders";
import { createPayment, decidePayment } from "@/services/payments";

/**
 * Server actions stay thin: parse with a shared schema, call a service, then
 * revalidate. No business logic lives here (see CLAUDE.md).
 *
 * NOTE: there is no authentication yet. Every action below would need an admin
 * check before this goes anywhere near real data — server actions are reachable
 * by direct POST, not only through the UI.
 */

export interface FormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createCustomerAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = customerInputSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    type: formData.get("type"),
    area: formData.get("area"),
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  await createCustomer(parsed.data);
  revalidatePath("/customers");
  redirect("/customers");
}

export async function createOrderAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = orderInputSchema.safeParse({
    customerId: formData.get("customerId"),
    deliveryDate: formData.get("deliveryDate"),
    productId: formData.get("productId"),
    quantity: formData.get("quantity"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  await createOrder(parsed.data);
  revalidatePath("/orders");
  revalidatePath("/distribution");
  revalidatePath("/");
  redirect("/orders");
}

export async function recordDeliveryAction(formData: FormData): Promise<void> {
  const status = formData.get("status");
  const orderedQuantity = Number(formData.get("orderedQuantity") ?? 0);

  // "Delivered in full" needs no typed quantity — take it from the order.
  const rawQuantity =
    status === "delivered"
      ? orderedQuantity
      : status === "not_delivered"
        ? 0
        : formData.get("deliveredQuantity");

  const parsed = recordDeliverySchema.safeParse({
    orderId: formData.get("orderId"),
    status,
    deliveredQuantity: rawQuantity,
    note: formData.get("note") || undefined,
  });

  if (!parsed.success) {
    // The prototype has no error surface on this screen yet; failing loudly in
    // the server log beats silently recording the wrong quantity.
    console.error("Invalid delivery submission", parsed.error.flatten());
    return;
  }

  try {
    await recordDelivery(parsed.data);
  } catch (error) {
    // The service rejects a quantity the order cannot support. Reaching this
    // through the UI is not possible, so log it rather than build a screen for
    // it — but never let it become an unhandled 500.
    console.error("Could not record that delivery", error);
    return;
  }

  revalidatePath("/distribution");
  revalidatePath("/");
}

export async function createPaymentAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = paymentInputSchema.safeParse({
    customerId: formData.get("customerId"),
    orderId: formData.get("orderId") || undefined,
    amountCedis: formData.get("amountCedis"),
    method: formData.get("method"),
    reference: formData.get("reference") || undefined,
    note: formData.get("note") || undefined,
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    await createPayment(parsed.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save that payment" };
  }

  revalidatePath("/payments");
  revalidatePath("/customers");
  revalidatePath("/reports");
  redirect("/payments");
}

/** The owner agreeing, or not, that a payment a customer reported arrived. */
export async function decidePaymentAction(formData: FormData): Promise<void> {
  const parsed = paymentDecisionSchema.safeParse({
    paymentId: formData.get("paymentId"),
    decision: formData.get("decision"),
  });

  if (!parsed.success) {
    console.error("Invalid payment decision", parsed.error.flatten());
    return;
  }

  try {
    await decidePayment(parsed.data);
  } catch (error) {
    console.error("Could not record that decision", error);
    return;
  }

  revalidatePath("/payments");
  revalidatePath("/customers");
  revalidatePath("/reports");
}

export async function createPurchaseAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = purchaseInputSchema.safeParse({
    itemId: formData.get("itemId"),
    date: formData.get("date"),
    quantity: formData.get("quantity"),
    unit: formData.get("unit"),
    unitPriceCedis: formData.get("unitPriceCedis"),
    supplier: formData.get("supplier") || undefined,
    note: formData.get("note") || undefined,
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  await createPurchase(parsed.data);
  revalidatePath("/spending");
  revalidatePath("/");
  redirect("/spending");
}

export async function rescheduleDeliveryAction(
  formData: FormData,
): Promise<void> {
  const parsed = rescheduleDeliverySchema.safeParse({
    orderId: formData.get("orderId"),
    newDate: formData.get("newDate"),
  });

  if (!parsed.success) {
    console.error("Invalid reschedule submission", parsed.error.flatten());
    return;
  }

  try {
    await rescheduleDelivery(parsed.data);
  } catch (error) {
    // No error surface on this screen yet. Failing loudly in the log beats
    // silently doing nothing and letting the owner think it worked.
    console.error("Could not reschedule", error);
    return;
  }

  revalidatePath("/distribution");
  revalidatePath("/orders");
  revalidatePath("/");
}

function fieldErrorsFrom(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): Record<string, string> {
  const result: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !result[key]) {
      result[key] = issue.message;
    }
  }

  return result;
}
