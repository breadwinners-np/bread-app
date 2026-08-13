import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

/**
 * Who is signed in, kept in a signed cookie.
 *
 * The cookie holds the customer id, when it was issued, and an HMAC of both.
 * Nothing is trusted without that signature: without it, changing one
 * character of the cookie would hand the visitor somebody else's order history
 * and balance.
 *
 * There is no server-side session table, so signing out on one device does not
 * end the session on another, and a stolen cookie stays valid until it
 * expires. That is the trade a demo makes; the real buyer app uses Supabase
 * auth (see decision 0027), which does keep server-side sessions.
 */

const COOKIE_NAME = "bread_customer";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * The signing key. `STOREFRONT_SESSION_SECRET` if it is set; otherwise derived
 * from the Supabase secret key, which is already a server-only secret this app
 * cannot run without.
 *
 * Derived rather than used directly so that the cookie signature never reveals
 * anything about the key it came from, and so setting the dedicated variable
 * later changes nothing else.
 */
function signingKey(): Buffer {
  const explicit = process.env.STOREFRONT_SESSION_SECRET;
  if (explicit) return Buffer.from(explicit, "utf8");

  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!fallback) {
    throw new Error(
      "Cannot sign customer sessions. Set STOREFRONT_SESSION_SECRET (or " +
        "SUPABASE_SERVICE_ROLE_KEY) in apps/storefront/.env.local.",
    );
  }

  return createHmac("sha256", fallback).update("storefront-session-v1").digest();
}

function sign(payload: string): string {
  return createHmac("sha256", signingKey()).update(payload).digest("base64url");
}

/** Constant-time, and never throws on a mismatched length. */
function signatureMatches(payload: string, signature: string): boolean {
  const expected = Buffer.from(sign(payload), "utf8");
  const given = Buffer.from(signature, "utf8");

  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** The signed-in customer's id, or null. Safe to call from any server code. */
export async function getSessionCustomerId(): Promise<string | null> {
  const cookie = (await cookies()).get(COOKIE_NAME)?.value;
  if (!cookie) return null;

  const [customerId, issuedAt, signature] = cookie.split(".");
  if (!customerId || !issuedAt || !signature) return null;
  if (!signatureMatches(`${customerId}.${issuedAt}`, signature)) return null;

  const age = Date.now() / 1000 - Number(issuedAt);
  if (!Number.isFinite(age) || age < 0 || age > MAX_AGE_SECONDS) return null;

  return customerId;
}

/** Only callable from a Server Function or Route Handler — cookies are headers. */
export async function startSession(customerId: string): Promise<void> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = `${customerId}.${issuedAt}`;

  (await cookies()).set(COOKIE_NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}
