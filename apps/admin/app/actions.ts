"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  customerInputSchema,
  orderInputSchema,
  recordDeliverySchema,
} from "@bread/shared";

import { createCustomer } from "@/services/customers";
import { recordDelivery } from "@/services/deliveries";
import { createOrder } from "@/services/orders";

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

  await recordDelivery(parsed.data);

  revalidatePath("/distribution");
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
