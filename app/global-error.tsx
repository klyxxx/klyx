"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#09090b",
          color: "#fafafa",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        }}
      >
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: "24px",
            boxSizing: "border-box",
          }}
        >
          <section
            style={{
              width: "min(100%, 640px)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "24px",
              background: "#111116",
              padding: "32px",
              boxSizing: "border-box",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "12px",
                fontWeight: 800,
                letterSpacing: "0.18em",
              }}
            >
              KLYX
            </p>
            <h1
              style={{
                margin: "12px 0 0",
                fontSize: "32px",
                lineHeight: 1.15,
              }}
            >
              KLYX doit être rechargé
            </h1>
            <p
              style={{
                margin: "14px 0 0",
                color: "#a1a1aa",
                lineHeight: 1.6,
              }}
            >
              Une erreur globale a interrompu l’application. Réessaie pour relancer KLYX proprement.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: "24px",
                minHeight: "44px",
                border: 0,
                borderRadius: "14px",
                background: "#fafafa",
                color: "#09090b",
                padding: "10px 18px",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Relancer KLYX
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
