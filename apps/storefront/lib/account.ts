import "server-only";

import { cache } from "react";

import {
  normalisePhone,
  toCustomer,
  toOrder,
  type Customer,
  type CustomerSignInInput,
  type CustomerSignUpInput,
  type DeliveryStatus,
  type Order,
  type OrderItemRow,
  type OrderRow,
} from "@bread/shared";

import { hashPin, pinMatches } from "./pin";
import { supabaseAdmin } from "./supabase-admin";

/**
 * Customer accounts.
 *
 * One person is one row in `customers`, found by their phone number however
 * they write it. Ordering while signed in adds to that row's history rather
 * than creating another one — which is what used to happen, leaving the owner
 * with several records for the same person and a balance split across them.
 */

export type AccountResult =
  | { ok: true; customerId: string }
  | { ok: false; error: string };

/**
 * Wrong-PIN attempts, per phone number, held in memory.
 *
 * A four-digit PIN is ten thousand guesses, which a script gets through in
 * seconds. This is what makes it a credential rather than a formality.
 *
 * In memory means it resets when the server restarts and is not shared between
 * instances. Good enough for a demo on one laptop; a real deployment needs
 * this in the database or in front of the app.
 */
const attempts = new Map<string, { count: number; firstAt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

function tooManyAttempts(phone: string): boolean {
  const record = attempts.get(phone);
  if (!record) return false;

  if (Date.now() - record.firstAt > LOCKOUT_MS) {
    attempts.delete(phone);
    return false;
  }

  return record.count >= MAX_ATTEMPTS;
}

function recordFailure(phone: string): void {
  const record = attempts.get(phone);

  if (!record || Date.now() - record.firstAt > LOCKOUT_MS) {
    attempts.set(phone, { count: 1, firstAt: Date.now() });
    return;
  }

  record.count += 1;
}

/**
 * Open an account.
 *
 * If the owner already has this person in her book — she wrote their number
 * down when they phoned in — that row is claimed rather than duplicated, and
 * her own record of them is left alone: the name, type and area she typed
 * stand, and only the blanks are filled in. Anything else would let a stranger
 * rename a wholesale customer from a public form.
 *
 * DEMO-GRADE: claiming an existing customer needs only their phone number, so
 * somebody who knows it could take the account before its owner does. The real
 * buyer app confirms the number by SMS first, which is open question AUTH-3.
 */
export async function signUpCustomer(
  input: CustomerSignUpInput,
): Promise<AccountResult> {
  const phone = normalisePhone(input.phone);

  const existing = await supabaseAdmin
    .from("customers")
    .select("id, name, area, type, address, email")
    .eq("phone_normalised", phone)
    .maybeSingle();

  if (existing.data) {
    const alreadyHasPin = await supabaseAdmin
      .from("customer_credentials")
      .select("customer_id")
      .eq("customer_id", existing.data.id)
      .maybeSingle();

    if (alreadyHasPin.data) {
      return {
        ok: false,
        error: "That number already has an account. Sign in with your PIN instead.",
      };
    }

    const filled = {
      address: existing.data.address ?? input.address,
      email: existing.data.email ?? (input.email || null),
    };

    const { error } = await supabaseAdmin
      .from("customers")
      .update(filled)
      .eq("id", existing.data.id);

    if (error) return { ok: false, error: "Could not save your details. Try again." };

    return setPin(existing.data.id as string, input.pin);
  }

  const created = await supabaseAdmin
    .from("customers")
    .insert({
      name: input.name,
      phone: input.phone,
      type: input.type,
      area: input.area,
      address: input.address,
      email: input.email || null,
      notes: "Opened an account online",
    })
    .select("id")
    .single();

  if (created.error) {
    // Someone signed up with this number between the check and the insert.
    // Their row is as good as ours would have been.
    if (created.error.code === "23505") {
      return {
        ok: false,
        error: "That number already has an account. Sign in with your PIN instead.",
      };
    }
    return { ok: false, error: "Could not create your account. Try again." };
  }

  return setPin(created.data.id as string, input.pin);
}

async function setPin(customerId: string, pin: string): Promise<AccountResult> {
  const { hash, salt } = await hashPin(pin);

  const { error } = await supabaseAdmin.from("customer_credentials").upsert(
    {
      customer_id: customerId,
      pin_hash: hash,
      pin_salt: salt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "customer_id" },
  );

  if (error) return { ok: false, error: "Could not save your PIN. Try again." };

  return { ok: true, customerId };
}

/**
 * Sign in.
 *
 * Every failure says the same thing whether the number is unknown or the PIN
 * is wrong, so this cannot be used to find out who has an account.
 */
export async function signInCustomer(
  input: CustomerSignInInput,
): Promise<AccountResult> {
  const phone = normalisePhone(input.phone);
  const wrong = { ok: false, error: "That number and PIN do not match." } as const;

  if (tooManyAttempts(phone)) {
    return {
      ok: false,
      error: "Too many tries. Wait a few minutes and try again.",
    };
  }

  const customer = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("phone_normalised", phone)
    .maybeSingle();

  if (!customer.data) {
    recordFailure(phone);
    return wrong;
  }

  const credentials = await supabaseAdmin
    .from("customer_credentials")
    .select("pin_hash, pin_salt")
    .eq("customer_id", customer.data.id)
    .maybeSingle();

  if (!credentials.data) {
    recordFailure(phone);
    return wrong;
  }

  const matches = await pinMatches(
    input.pin,
    credentials.data.pin_hash as string,
    credentials.data.pin_salt as string,
  );

  if (!matches) {
    recordFailure(phone);
    return wrong;
  }

  attempts.delete(phone);
  return { ok: true, customerId: customer.data.id as string };
}

/**
 * The signed-in customer, or null.
 *
 * Wrapped in React's `cache` so a page that needs it in three places still
 * makes one query, and every one of those places sees the same row.
 */
export const getCustomerById = cache(
  async (customerId: string): Promise<Customer | null> => {
    const { data } = await supabaseAdmin
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .maybeSingle();

    return data ? toCustomer(data) : null;
  },
);

/** One of the customer's orders, with everything their history page shows. */
export interface CustomerOrder {
  order: Order;
  deliveryStatus: DeliveryStatus;
  paid: boolean;
  totalPesewas: number;
}

/**
 * `deliveries.order_id` is unique, so PostgREST treats the embed as a to-one
 * and hands back an object rather than an array — but only on versions new
 * enough to detect that. Both shapes are accepted rather than betting on which
 * Supabase project this runs against; guessing wrong would show every order as
 * undelivered, with no error anywhere.
 */
type OrderRowWithChildren = OrderRow & {
  order_items: OrderItemRow[];
  deliveries: { status: DeliveryStatus } | { status: DeliveryStatus }[] | null;
};

function deliveryStatusOf(row: OrderRowWithChildren): DeliveryStatus {
  const embedded = row.deliveries;
  if (!embedded) return "pending";

  return (Array.isArray(embedded) ? embedded[0]?.status : embedded.status) ?? "pending";
}

/**
 * Everything this customer has ordered, newest delivery day first.
 *
 * Scoped by customer id from the signed cookie, never from anything the
 * browser sent in this request — a customer can only ever read their own rows.
 */
export async function listOrdersForCustomer(
  customerId: string,
): Promise<CustomerOrder[]> {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("*, order_items(*), deliveries(status)")
    .eq("customer_id", customerId)
    .order("delivery_date", { ascending: false })
    // By basket position, not created_at: every line of an order is written in
    // one statement and shares a timestamp, so created_at alone leaves ties.
    .order("position", { referencedTable: "order_items", ascending: true })
    .returns<OrderRowWithChildren[]>();

  if (error) throw new Error(`Could not load your orders: ${error.message}`);

  return (data ?? [])
    // An order that was never paid for was never placed — the customer left
    // the payment step. It stays off their history, as it stays off hers.
    .filter((row) => row.payment_status !== "pending")
    .map((row) => {
      const deliveryStatus = deliveryStatusOf(row);

      return {
        order: toOrder(row, row.order_items ?? [], deliveryStatus),
        deliveryStatus,
        paid: row.payment_status === "paid",
        totalPesewas: row.total_pesewas ?? 0,
      };
    });
}
