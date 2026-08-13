/**
 * What she sees the instant she clicks, on every screen.
 *
 * Every page here is `force-dynamic` and reads several tables from Supabase, so
 * a click used to leave the old page sitting there, apparently ignoring her,
 * until the server had finished. Nothing was slow enough to look broken and
 * nothing was fast enough to look immediate — the worst of both.
 *
 * This is the fallback for the Suspense boundary Next wraps every page in. It
 * costs one round trip less than nothing: the page underneath still takes as
 * long as it takes, but the click is acknowledged straight away and the shape
 * of what is coming is already on screen.
 *
 * Deliberately grey blocks rather than a spinner. A spinner says "waiting"; a
 * skeleton in the shape of the page says "this is what is arriving", which is
 * the difference between a screen that feels slow and one that feels busy.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="animate-pulse">
      <span className="sr-only">Loading</span>

      <div className="mb-10">
        <div className="h-9 w-56 rounded-md bg-stone-200" />
        <div className="mt-3 h-5 w-80 rounded-md bg-stone-100" />
      </div>

      <div className="mb-10 grid gap-x-8 gap-y-6 border-y border-stone-200 py-6 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((tile) => (
          <div key={tile}>
            <div className="h-5 w-28 rounded-md bg-stone-100" />
            <div className="mt-2 h-9 w-32 rounded-md bg-stone-200" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-stone-200 bg-white">
        {[0, 1, 2, 3].map((row) => (
          <div
            key={row}
            className="flex items-center justify-between gap-4 border-b border-stone-100 px-6 py-5 last:border-b-0"
          >
            <div className="flex-1">
              <div className="h-5 w-44 rounded-md bg-stone-200" />
              <div className="mt-2 h-4 w-32 rounded-md bg-stone-100" />
            </div>
            <div className="h-5 w-24 rounded-md bg-stone-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
