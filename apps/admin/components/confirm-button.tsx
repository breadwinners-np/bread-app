"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { buttonClass, type ButtonVariant } from "@/components/ui";

/**
 * A button that asks before it acts.
 *
 * The primary user is not technical and works quickly through a delivery round,
 * so an action with a consequence should take two deliberate clicks rather than
 * one stray one. The common, harmless path — "delivered in full", dozens of
 * times a morning — deliberately does NOT use this.
 *
 * It renders inside an ordinary `<form action={serverAction}>`: the trigger is
 * a plain button that reveals a panel, and the panel holds the real submit
 * button carrying `name`/`value`. Fields passed as `children` live inside the
 * panel, so they only exist — and only submit — once she has opened it.
 */
export function ConfirmButton({
  label,
  question,
  confirmLabel,
  name,
  value,
  variant = "secondary",
  confirmVariant = "primary",
  children,
}: {
  /** The button she sees first. */
  label: string;
  /** What the confirmation panel asks her. Written as a full question. */
  question: string;
  /** The button that actually does it. Repeats the action, never just "Yes". */
  confirmLabel: string;
  /** Submitted with the form, so one form can host several actions. */
  name?: string;
  value?: string;
  variant?: ButtonVariant;
  confirmVariant?: ButtonVariant;
  /** Fields needed to complete the action, e.g. a quantity. */
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Move focus into the panel when it opens, so the keyboard lands on the
  // question rather than staying behind on a button that has gone away.
  useEffect(() => {
    if (!open) return;
    const target = panelRef.current?.querySelector<HTMLElement>(
      "input, select, textarea, button",
    );
    target?.focus();
  }, [open]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClass(variant)}
      >
        {label}
      </button>
    );
  }

  return (
    <div
      ref={panelRef}
      role="group"
      aria-label={question}
      className="w-full rounded-lg border border-stone-300 bg-stone-50 p-5"
    >
      <p className="font-medium text-stone-900">{question}</p>

      {children && <div className="mt-3">{children}</div>}

      <div className="mt-4 flex flex-wrap gap-3">
        <SubmitButton
          name={name}
          value={value}
          variant={confirmVariant}
          label={confirmLabel}
        />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={buttonClass("secondary")}
        >
          No, go back
        </button>
      </div>
    </div>
  );
}

/**
 * The real submit. Disables itself while the action is running so an impatient
 * second click cannot record the same delivery twice.
 */
function SubmitButton({
  name,
  value,
  variant,
  label,
}: {
  name?: string;
  value?: string;
  variant: ButtonVariant;
  label: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={buttonClass(variant)}
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

/**
 * A plain submit button that also guards against a double click. For actions
 * that need no confirmation but still write to the record.
 */
export function GuardedSubmit({
  name,
  value,
  variant = "primary",
  label,
  pendingLabel = "Saving…",
}: {
  name?: string;
  value?: string;
  variant?: ButtonVariant;
  label: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={buttonClass(variant)}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
