"use client";

import { useActionState, useState } from "react";

import { CUSTOMER_TYPE_LABELS, CUSTOMER_TYPE_OPTIONS } from "@bread/shared";

import { signInAction, signUpAction, type AccountFormState } from "@/app/account/actions";

const INITIAL: AccountFormState = {};

const inputClass =
  "w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900 placeholder:text-stone-400";

/**
 * Opening an account, or signing back into one.
 *
 * Signing in comes first and is three fields, because most people arriving
 * here already have an account. Opening one asks for everything the owner
 * needs to actually find them: who they are, where they are, and whether they
 * are a shop or a household — she treats those two differently.
 */
export function AccountForms({ next }: { next: string }) {
  const [tab, setTab] = useState<"in" | "up">("in");

  return (
    <div className="space-y-6">
      <div className="flex gap-6 border-b border-stone-200">
        <Tab active={tab === "in"} onClick={() => setTab("in")}>
          I have an account
        </Tab>
        <Tab active={tab === "up"} onClick={() => setTab("up")}>
          Open an account
        </Tab>
      </div>

      {tab === "in" ? <SignInForm next={next} /> : <SignUpForm next={next} />}
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`-mb-px border-b-2 pb-3 font-medium ${
        active
          ? "border-stone-900 text-stone-900"
          : "border-transparent text-stone-500 hover:text-stone-900"
      }`}
    >
      {children}
    </button>
  );
}

function SignInForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signInAction, INITIAL);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="next" value={next} />

      <Field label="Phone number" error={state.fieldErrors?.phone}>
        <input
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="024 000 0000"
          className={inputClass}
        />
      </Field>

      <Field label="Your 4-digit PIN" error={state.fieldErrors?.pin}>
        <input
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          maxLength={4}
          className={`${inputClass} max-w-32 tracking-[0.5em]`}
        />
      </Field>

      <FormError message={state.error} />

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-stone-900 px-4 py-3 font-medium text-white disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

function SignUpForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signUpAction, INITIAL);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="next" value={next} />

      <Field label="Your name" error={state.fieldErrors?.name}>
        <input name="name" autoComplete="name" className={inputClass} />
      </Field>

      <Field
        label="Phone number"
        hint="This is how we reach you, and how you sign in."
        error={state.fieldErrors?.phone}
      >
        <input
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="024 000 0000"
          className={inputClass}
        />
      </Field>

      <Field
        label="Are you ordering for a business or for yourself?"
        error={state.fieldErrors?.type}
      >
        <select name="type" defaultValue="individual" className={inputClass}>
          {CUSTOMER_TYPE_OPTIONS.map((type) => (
            <option key={type} value={type}>
              {type === "business"
                ? `${CUSTOMER_TYPE_LABELS.business} — a shop, office or school`
                : `${CUSTOMER_TYPE_LABELS.individual} — for my household`}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Which area are you in?" error={state.fieldErrors?.area}>
        <input name="area" placeholder="East Legon" className={inputClass} />
      </Field>

      <Field
        label="Your address"
        hint="House, street or a landmark. You can send an order somewhere else when you order."
        error={state.fieldErrors?.address}
      >
        <textarea name="address" rows={2} className={inputClass} />
      </Field>

      <Field label="Email (optional)" error={state.fieldErrors?.email}>
        <input name="email" type="email" autoComplete="email" className={inputClass} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Choose a 4-digit PIN" error={state.fieldErrors?.pin}>
          <input
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={4}
            className={`${inputClass} tracking-[0.5em]`}
          />
        </Field>

        <Field label="Type it again" error={state.fieldErrors?.pinConfirm}>
          <input
            name="pinConfirm"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={4}
            className={`${inputClass} tracking-[0.5em]`}
          />
        </Field>
      </div>

      <FormError message={state.error} />

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-stone-900 px-4 py-3 font-medium text-white disabled:opacity-60"
      >
        {pending ? "Creating your account…" : "Create my account"}
      </button>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block font-medium text-stone-900">{label}</span>
      {hint && <span className="mt-0.5 block text-sm text-stone-500">{hint}</span>}
      <span className="mt-1.5 block">{children}</span>
      {error && (
        <span className="mt-1 block text-sm font-medium text-red-700">{error}</span>
      )}
    </label>
  );
}

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
      {message}
    </p>
  );
}
