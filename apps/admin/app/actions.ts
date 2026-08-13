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
import { cancelOrder, createOrder } from "@/services/orders";
import { createPayment, decidePayment } from "@/services/payments";

/**
 * Screens that change when an order, delivery or payment does. Listed once
 * because almost every action below touches several of them — an order moving
 * changes the day's round, the customer's balance and the month's report, and
 * missing one leaves the owner looking at a stale number.
 */
const MONEY_AND_ROUND_PATHS = [
  "/",
  "/orders",
  "/distribution",
  "/payments",
  "/customers",
  "/reports",
];

function revalidateMoneyAndRound(): void {
  for (const path of MONEY_AND_ROUND_PATHS) revalidatePath(path);
}

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
    address: formData.get("address") || undefined,
    email: formData.get("email") || "",
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    await createCustomer(parsed.data);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not save that customer",
    };
  }

  revalidateMoneyAndRound();
  redirect("/customers");
}

export async function createOrderAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  // A customer phoning in for the first time can be created from this same
  // form, so she does not lose the order she is halfway through writing down.
  let customerId = formData.get("customerId");

  if (formData.get("newCustomer") === "yes") {
    const parsedCustomer = customerInputSchema.safeParse({
      name: formData.get("newCustomerName"),
      phone: formData.get("newCustomerPhone"),
      type: formData.get("newCustomerType"),
      area: formData.get("newCustomerArea"),
    });

    if (!parsedCustomer.success) {
      return { fieldErrors: fieldErrorsFrom(parsedCustomer.error) };
    }

    try {
      const customer = await createCustomer(parsedCustomer.data);
      customerId = customer.id;
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Could not save that customer",
      };
    }
  }

  // One order can carry several breads, so the form sends a product and a
  // quantity per row: product[0], quantity[0], product[1], and so on. Rows she
  // added and then left empty are dropped rather than refused.
  const lines = formData
    .getAll("productId")
    .map((productId, index) => ({
      productId,
      quantity: formData.getAll("quantity")[index] ?? "0",
    }))
    .filter((line) => line.productId && Number(line.quantity) > 0);

  const parsed = orderInputSchema.safeParse({
    customerId,
    deliveryDate: formData.get("deliveryDate"),
    lines,
    deliveryAddress: formData.get("deliveryAddress") || undefined,
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    await createOrder(parsed.data);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not save that order",
    };
  }

  revalidateMoneyAndRound();
  redirect("/orders");
}

/**
 * Cancel an order, keeping the record. Confirmed in the UI before it fires —
 * this is the destructive one on the orders screen.
 */
export async function cancelOrderAction(formData: FormData): Promise<void> {
  const orderId = formData.get("orderId");

  if (typeof orderId !== "string" || !orderId) {
    console.error("Cancel order called without an order id");
    return;
  }

  try {
    await cancelOrder(orderId);
  } catch (error) {
    console.error("Could not cancel that order", error);
    return;
  }

  revalidateMoneyAndRound();
}

export async function recordDeliveryAction(formData: FormData): Promise<void> {
  // How many of each bread arrived, submitted as delivered[<order line id>].
  // "Delivered in full" and "could not deliver" send none of these: those two
  // are read off the order itself, never off the form.
  const deliveredByLine: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    const match = /^delivered\[(.+)\]$/.exec(key);
    if (match?.[1] && typeof value === "string" && value !== "") {
      deliveredByLine[match[1]] = value;
    }
  }

  const parsed = recordDeliverySchema.safeParse({
    orderId: formData.get("orderId"),
    status: formData.get("status"),
    deliveredByLine,
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

  revalidateMoneyAndRound();
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

  revalidateMoneyAndRound();
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

  revalidateMoneyAndRound();
}

export async function createPurchaseAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = purchaseInputSchema.safeParse({
    itemId: formData.get("itemId"),
    // Only read when she chose "Something else" — see NEW_SUPPLY_ITEM.
    newItemName: formData.get("newItemName") || undefined,
    newItemCategory: formData.get("newItemCategory") || undefined,
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

  try {
    await createPurchase(parsed.data);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not save that purchase",
    };
  }

  revalidatePath("/spending");
  revalidatePath("/reports");
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

  revalidateMoneyAndRound();
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
