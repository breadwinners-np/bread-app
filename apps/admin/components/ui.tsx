import Link from "next/link";

/**
 * Shared presentation pieces.
 *
 * Deliberately plain and large: the primary user is not technical, so every
 * action should be obvious and hard to mis-click.
 */

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-lg text-stone-500">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-stone-200 bg-white p-6 ${className}`}
    >
      {children}
    </section>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-xl font-semibold text-stone-900">{children}</h2>
  );
}

export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <p className="text-sm font-medium text-stone-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums text-stone-900">
        {value}
      </p>
      {hint && <p className="mt-1 text-sm text-stone-500">{hint}</p>}
    </div>
  );
}

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const BUTTON_VARIANTS = {
  primary: "bg-amber-600 text-white hover:bg-amber-700",
  secondary: "border border-stone-300 bg-white text-stone-800 hover:bg-stone-50",
  quiet: "text-stone-600 hover:bg-stone-100",
} as const;

export type ButtonVariant = keyof typeof BUTTON_VARIANTS;

export function buttonClass(variant: ButtonVariant = "primary"): string {
  return `${BUTTON_BASE} ${BUTTON_VARIANTS[variant]}`;
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: ButtonVariant;
}) {
  return (
    <Link href={href} className={buttonClass(variant)}>
      {children}
    </Link>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "info";
}) {
  const tones = {
    neutral: "bg-stone-100 text-stone-700",
    good: "bg-green-100 text-green-800",
    warn: "bg-amber-100 text-amber-900",
    bad: "bg-red-100 text-red-800",
    info: "bg-blue-100 text-blue-800",
  } as const;

  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center">
      <p className="text-lg font-semibold text-stone-700">{title}</p>
      {description && <p className="mt-2 text-stone-500">{description}</p>}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-base font-semibold text-stone-800">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-sm text-stone-500">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 placeholder:text-stone-400 focus:border-amber-600 focus:outline-none";

/**
 * Marks a section that is intentionally not built yet, rather than broken.
 * Keeps the shape of the finished app visible while the business rules that
 * block it are still open.
 */
export function ComingSoon({
  title,
  description,
  blockedBy,
}: {
  title: string;
  description: string;
  blockedBy?: string[];
}) {
  return (
    <Card className="border-dashed">
      <h2 className="text-xl font-semibold text-stone-800">{title}</h2>
      <p className="mt-2 max-w-2xl text-stone-600">{description}</p>

      {blockedBy && blockedBy.length > 0 && (
        <div className="mt-6 rounded-xl bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            Waiting on answers to:
          </p>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {blockedBy.map((question) => (
              <li key={question}>— {question}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
