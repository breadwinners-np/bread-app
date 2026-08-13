/**
 * Shared plumbing for the verification scripts.
 *
 * These talk to a real Supabase project over PostgREST rather than a test
 * double, because what they check — row level security, execute permissions,
 * database constraints, transaction boundaries — only exists in the database.
 * A mock would agree with whatever we assumed and prove nothing.
 *
 * Credentials come from apps/storefront/.env.local, which is gitignored. No
 * key is ever written into these files.
 */
import fs from "node:fs";
import path from "node:path";

const ENV_PATH = path.join("apps", "storefront", ".env.local");

function readEnv() {
  if (!fs.existsSync(ENV_PATH)) {
    console.error(
      `Missing ${ENV_PATH}. Copy apps/storefront/.env.example to it and fill in\n` +
        "the Supabase URL, publishable key and secret key. See apps/storefront/README.md.",
    );
    process.exit(2);
  }

  return Object.fromEntries(
    fs
      .readFileSync(ENV_PATH, "utf8")
      .split("\n")
      .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
      .map((line) => {
        const i = line.indexOf("=");
        return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
      }),
  );
}

const env = readEnv();

export const URL = env.NEXT_PUBLIC_SUPABASE_URL;
/** The key that ships inside every browser. Anything it can do, a stranger can do. */
export const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
/** Server-side only. Used here to set up and clean up, and to prove the anon key cannot. */
export const SECRET = env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON || !SECRET) {
  console.error(`${ENV_PATH} is missing one of the three Supabase values.`);
  process.exit(2);
}

let passed = 0;
let failed = 0;

export function group(name) {
  console.log(`\n--- ${name} ---`);
}

export function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  ok ? passed++ : failed++;
  return ok;
}

export function expectEqual(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  return check(name, ok, ok ? "" : `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
}

export function report() {
  console.log(`\n${passed} passed, ${failed} failed`);
  return failed === 0;
}

export function finish() {
  process.exit(report() ? 0 : 1);
}

async function request(pathAndQuery, key, init = {}) {
  const response = await fetch(`${URL}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return { status: response.status, body, headers: response.headers };
}

/** As a stranger with the publishable key would see it. */
export const asAnon = (pathAndQuery, init) => request(pathAndQuery, ANON, init);
/** As server-side code holding the secret key. */
export const asServer = (pathAndQuery, init) => request(pathAndQuery, SECRET, init);

export const rpcAsAnon = (fn, args) =>
  asAnon(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
export const rpcAsServer = (fn, args) =>
  asServer(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });

export async function rowCount(table) {
  const { headers } = await asServer(`${table}?select=*`, { headers: { Prefer: "count=exact" } });
  return Number((headers.get("content-range") || "").split("/")[1]);
}

/** Test rows are named with this prefix so cleanup can always find them. */
export const TEST_PREFIX = "ZZ Verify";
