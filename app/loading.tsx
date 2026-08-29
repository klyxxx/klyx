export default function Loading() {
  return (
    <main
      className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Chargement de KLYX…</span>

      <div className="animate-pulse space-y-6" aria-hidden="true">
        <div className="space-y-3">
          <div className="h-4 w-28 rounded-full bg-muted" />
          <div className="h-9 w-full max-w-md rounded-2xl bg-muted" />
          <div className="h-4 w-full max-w-2xl rounded-full bg-muted" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-36 rounded-3xl border border-border bg-card"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
