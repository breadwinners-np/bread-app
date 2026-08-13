"use server";

import { redirect } from "next/navigation";

import { customerSignInSchema, customerSignUpSchema } from "@bread/shared";

import { signInCustomer, signUpCustomer } from "@/lib/account";
import { endSession, startSession } from "@/lib/session";

/**
 * Opening an account, signing in, signing out.
 *
 * Thin on purpose: parse with a shared schema, call the service, start the
 * session. Everything that decides whether a person is who they say they are
 * lives in lib/account.ts.
 */

export interface AccountFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

/** Only somewhere inside this app, so a crafted ?next= cannot bounce a customer off-site. */
function safeNext(next: FormDataEntryValue | null): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//")
    ? next
    : "/account";
}

export async function signUpAction(
  _previous: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const parsed = customerSignUpSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    type: formData.get("type"),
    area: formData.get("area"),
    address: formData.get("address"),
    email: formData.get("email") || "",
    pin: formData.get("pin"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  if (parsed.data.pin !== formData.get("pinConfirm")) {
    return { fieldErrors: { pinConfirm: "The two PINs are not the same" } };
  }

  const result = await signUpCustomer(parsed.data);
  if (!result.ok) return { error: result.error };

  await startSession(result.customerId);
  redirect(safeNext(formData.get("next")));
}

export async function signInAction(
  _previous: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const parsed = customerSignInSchema.safeParse({
    phone: formData.get("phone"),
    pin: formData.get("pin"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const result = await signInCustomer(parsed.data);
  if (!result.ok) return { error: result.error };

  await startSession(result.customerId);
  redirect(safeNext(formData.get("next")));
}

export async function signOutAction(): Promise<void> {
  await endSession();
  redirect("/");
}

function fieldErrorsFrom(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): Record<string, string> {
  const result: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !result[key]) result[key] = issue.message;
  }

  return result;
}
