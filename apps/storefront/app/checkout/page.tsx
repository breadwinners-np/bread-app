import Link from "next/link";

import { CheckoutForm } from "@/components/checkout-form";
import { getCustomerById } from "@/lib/account";
import { getSessionCustomerId } from "@/lib/session";

// Reads the session cookie, so it can never be prerendered and cached.
export const dynamic = "force-dynamic";

/**
 * Checkout is behind an account.
 *
 * Before, a checkout took a name and a phone number typed fresh every time,
 * and the smallest difference in how the number was written made a second
 * customer record. Signing in first means one person is one record, their
 * orders build one history, and the owner sees one balance for them.
 */
export default async function CheckoutPage() {
  const customerId = await getSessionCustomerId();
  const customer = customerId ? await getCustomerById(customerId) : null;

  if (!customer) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-semibold text-stone-900">
          Sign in to place your order
        </h1>
        <p className="text-stone-600">
          Your cart is saved. Sign in — or open an account, it takes a minute —
          and we will bring you straight back here.
        </p>
        <Link
          href="/account?next=/checkout"
          className="inline-block rounded-full bg-stone-900 px-5 py-3 font-medium text-white"
        >
          Sign in or open an account
        </Link>
      </div>
    );
  }

  return <CheckoutForm customer={customer} />;
}
