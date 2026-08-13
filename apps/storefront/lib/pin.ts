import "server-only";

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Storing and checking a customer's PIN.
 *
 * A PIN is four digits, so there are only ten thousand of them. That is why it
 * is never stored in the clear and never compared as a string: scrypt is
 * deliberately slow and salted per customer, so someone holding the table
 * cannot work back from a hash, and a comparison that returns early cannot be
 * timed.
 *
 * Four digits is still four digits. What actually protects an account is that
 * `signIn` gives up after a handful of wrong tries — see lib/account.ts.
 */

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;

export async function hashPin(
  pin: string,
): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(pin, salt, KEY_LENGTH);

  return { hash: derived.toString("hex"), salt };
}

export async function pinMatches(
  pin: string,
  hash: string,
  salt: string,
): Promise<boolean> {
  const derived = await scryptAsync(pin, salt, KEY_LENGTH);
  const stored = Buffer.from(hash, "hex");

  return derived.length === stored.length && timingSafeEqual(derived, stored);
}
