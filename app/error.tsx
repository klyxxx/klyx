"use client";

export default function ErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center px-4 py-12 sm:px-6">
      <section className="w-full rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-10">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
          KLYX
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
          Une erreur est survenue
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
          La page n’a pas pu se charger correctement. Tu peux réessayer sans perdre ta session.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-foreground px-5 py-2.5 text-sm font-bold text-background transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Réessayer
          </button>
          <a
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-border bg-background px-5 py-2.5 text-sm font-bold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Retour à l’accueil
          </a>
        </div>
      </section>
    </main>
  );
}
