/**
 * What the content column shows between pages.
 *
 * Without this, a click in the rail did nothing visible until the next page's
 * query and render had both finished — a few hundred milliseconds in
 * development, more with the production database — so the rail felt dead.
 * With it, the rail highlights the new page at once and this stands in for
 * the header and first rows until they stream in.
 */
export default function WorldToolLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8" aria-busy="true" aria-live="polite">
      <div className="h-7 w-44 animate-pulse rounded bg-surface-raised" />
      <div className="mt-3 h-4 w-full max-w-xl animate-pulse rounded bg-surface-raised/70" />
      <div className="mt-8 overflow-hidden rounded-lg border border-line-subtle">
        <div className="h-9 animate-pulse bg-surface-panel" />
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="h-10 animate-pulse border-t border-line-subtle bg-surface-panel/40"
            style={{ opacity: 1 - i * 0.1 }}
          />
        ))}
      </div>
      <span className="sr-only">Loading</span>
    </div>
  )
}
