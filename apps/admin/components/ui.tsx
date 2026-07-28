import Link from "next/link";

/**
 * Shared presentation pieces.
 *
 * The design is deliberately quiet. The primary user is around fifty and not
 * technical, and the temptation with that brief is to make everything big and
 * bold — which removes the hierarchy that actually helps her, and leaves a
 * screen that shouts uniformly.
 *
 * The rules here instead:
 *
 * 1. **The 18px base does the work.** Body text is `text-base`. Only a real
 *    heading or a headline number goes above it, so when something is large it
 *    means something.
 * 2. **Contrast over weight.** stone-600 on white is 7:1; that is what makes
 *    secondary text readable, not bolding it.
 * 3. **One accent.** Near-black is the primary action. Amber marks where she
 *    is, and colour otherwise appears only where a state needs it.
 * 4. **Few boxes.** Borders are hairlines. A stat tile has no box at all —
 *    space separates it. Nested panels-inside-cards are avoided.
 * 5. **Colour is never the only signal.** Every tone pairs with a word.
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
    <header className="mb-10 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 text-stone-600">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Card({
  children,
  className = "",
  /** Off for cards whose children manage their own edges, e.g. a full-bleed list. */
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={`rounded-xl border border-stone-200 bg-white ${padded ? "p-6" : ""} ${className}`}
    >
      {children}
    </section>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-semibold text-stone-900">{children}</h2>
  );
}

/**
 * A single headline number, with no box around it.
 *
 * Four bordered tiles in a row was four competing rectangles; the number is
 * large enough to hold its own on the page background, and the space between
 * them does the separating.
 */
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
    <div>
      <p className="text-stone-600">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-stone-900">
        {value}
      </p>
      {hint && <p className="mt-1 text-sm text-stone-500">{hint}</p>}
    </div>
  );
}

/** Wraps a row of StatTiles with the dividers and spacing they expect. */
export function StatRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-10 grid gap-x-8 gap-y-6 border-y border-stone-200 py-6 sm:grid-cols-2 lg:grid-cols-4">
      {children}
    </div>
  );
}

/**
 * Buttons stay tall enough to hit without aiming, but no longer shout: the
 * primary is near-black rather than a saturated fill, which reads as more
 * considered and happens to give 16:1 contrast instead of 4.8:1.
 */
const BUTTON_BASE =
  "inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-lg px-5 py-2.5 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const BUTTON_VARIANTS = {
  primary: "bg-stone-900 text-white hover:bg-stone-800",
  secondary: "border border-stone-300 bg-white text-stone-800 hover:bg-stone-50",
  danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
  quiet: "text-stone-600 hover:bg-stone-100 hover:text-stone-900",
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

/**
 * A state, as a quiet tinted pill. The -50 backgrounds keep these from
 * competing with the content they describe; the -800 ink keeps them legible.
 */
export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "info";
}) {
  const tones = {
    neutral: "bg-stone-100 text-stone-700",
    good: "bg-green-50 text-green-800",
    warn: "bg-amber-50 text-amber-800",
    bad: "bg-red-50 text-red-800",
    info: "bg-blue-50 text-blue-800",
  } as const;

  return (
    <span
      className={`inline-block whitespace-nowrap rounded-md px-2.5 py-1 text-sm font-medium ${tones[tone]}`}
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
    <div className="rounded-xl border border-dashed border-stone-300 px-6 py-14 text-center">
      <p className="text-lg font-medium text-stone-800">{title}</p>
      {description && (
        <p className="mx-auto mt-1.5 max-w-md text-stone-600">{description}</p>
      )}
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
      <span className="block font-medium text-stone-900">{label}</span>
      {hint && <span className="mt-0.5 block text-sm text-stone-500">{hint}</span>}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-stone-900 placeholder:text-stone-400 focus:border-stone-900 focus:outline-none";

/**
 * A banner leading somewhere that needs her.
 *
 * A hairline left rule carries the urgency instead of a saturated filled box,
 * so two of these stacked at the top of Today still leave the page calm.
 */
export function NoticeLink({
  href,
  tone,
  title,
  description,
  actionLabel,
}: {
  href: string;
  tone: "urgent" | "attention";
  title: string;
  description: string;
  actionLabel: string;
}) {
  const rule = tone === "urgent" ? "border-l-red-600" : "border-l-amber-500";

  return (
    <Link
      href={href}
      className={`mb-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-stone-200 border-l-4 bg-white px-5 py-4 transition-colors hover:bg-stone-50 ${rule}`}
    >
      <div>
        <p className="font-semibold text-stone-900">{title}</p>
        <p className="mt-0.5 text-stone-600">{description}</p>
      </div>
      <span className="whitespace-nowrap font-medium text-stone-900 underline underline-offset-4">
        {actionLabel}
      </span>
    </Link>
  );
}

/**
 * A question the software needs the owner to answer.
 *
 * These replace developer notes that used to cite identifiers like DST-7. The
 * uncertainty is real and worth showing her — the prototype exists partly to
 * provoke these answers — but it is secondary to the screen it sits under, so
 * it is set quietly rather than in a coloured box competing with the content.
 * The identifiers stay in DECISIONS.md, where a teammate looks them up.
 */
export function QuestionForYou({
  children,
  heading = "A question for you",
}: {
  children: React.ReactNode;
  heading?: string;
}) {
  return (
    <aside className="mt-12 border-t border-stone-200 pt-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
        {heading}
      </h2>
      <div className="mt-3 max-w-2xl space-y-2 text-stone-700">{children}</div>
    </aside>
  );
}

/**
 * States plainly how the app behaves, where that behaviour is a decision she
 * might disagree with. Distinct from QuestionForYou: this tells her what it
 * does rather than asking what it should do.
 */
export function HowThisWorks({ children }: { children: React.ReactNode }) {
  return (
    <aside className="mt-12 border-t border-stone-200 pt-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
        How this works
      </h2>
      <div className="mt-3 max-w-2xl space-y-2 text-stone-700">{children}</div>
    </aside>
  );
}

/**
 * Marks a section that is intentionally not built yet, rather than broken.
 * Keeps the shape of the finished app visible while the business rules that
 * block it are still open.
 */
export function ComingSoon({
  title,
  description,
  questions,
}: {
  title: string;
  description: string;
  /** Plain-language questions, in her words — no identifiers. */
  questions?: string[];
}) {
  return (
    <div className="rounded-xl border border-dashed border-stone-300 p-6">
      <h2 className="text-lg font-semibold text-stone-800">{title}</h2>
      <p className="mt-1.5 max-w-2xl text-stone-600">{description}</p>

      {questions && questions.length > 0 && (
        <div className="mt-5 border-t border-stone-200 pt-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Before it can be built, we need to know
          </p>
          <ul className="mt-3 max-w-2xl space-y-2 text-stone-700">
            {questions.map((question) => (
              <li key={question} className="flex gap-3">
                <span aria-hidden className="text-stone-400">
                  —
                </span>
                <span>{question}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
