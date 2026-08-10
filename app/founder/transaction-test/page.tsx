"use client";

import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Check = {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
  severity: "blocking" | "warning" | "info";
};

type Readiness = {
  ready: boolean;
  blocking: number;
  warnings: number;
  checks: Check[];
  flow: string[];
  error?: string;
};

export default function TransactionTestPage() {
  const [data, setData] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch(
        "/api/founder/transaction-readiness",
        { cache: "no-store" }
      );

      const body = (await response.json()) as Readiness;

      if (!response.ok) {
        throw new Error(
          body.error || "Audit impossible."
        );
      }

      setData(body);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Audit impossible."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="klyx-eyebrow">
              Founder · KLYX 12.17
            </p>
            <h1 className="klyx-title mt-2">
              Test transactionnel
            </h1>
            <p className="klyx-subtitle">
              Vérifie la chaîne réservation → paiement →
              mission → avis avant KLYX Mobile.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="klyx-button-secondary"
          >
            {loading ? (
              <LoaderCircle
                size={18}
                className="animate-spin"
              />
            ) : (
              <RefreshCw size={18} />
            )}
            Relancer
          </button>
        </div>

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-700 dark:text-red-300">
            {errorMessage}
          </div>
        )}

        {data && (
          <>
            <section className="mt-7 grid gap-4 sm:grid-cols-3">
              <Metric
                label="État"
                value={data.ready ? "PRÊT" : "BLOQUÉ"}
                good={data.ready}
              />
              <Metric
                label="Blocages"
                value={String(data.blocking)}
                good={data.blocking === 0}
              />
              <Metric
                label="Alertes"
                value={String(data.warnings)}
                good={data.warnings === 0}
              />
            </section>

            <section className="klyx-card mt-6 p-6">
              <div className="flex items-center gap-3">
                <ShieldCheck
                  size={23}
                  className="text-violet-600 dark:text-violet-400"
                />
                <h2 className="text-xl font-black">
                  Contrôles
                </h2>
              </div>

              <div className="mt-5 grid gap-3">
                {data.checks.map((check) => (
                  <article
                    key={check.key}
                    className="flex items-start gap-3 rounded-2xl border border-border bg-background/70 p-4"
                  >
                    {check.ok ? (
                      <CheckCircle2
                        className="mt-0.5 shrink-0 text-emerald-600"
                        size={20}
                      />
                    ) : check.severity === "warning" ? (
                      <AlertTriangle
                        className="mt-0.5 shrink-0 text-amber-600"
                        size={20}
                      />
                    ) : (
                      <XCircle
                        className="mt-0.5 shrink-0 text-red-600"
                        size={20}
                      />
                    )}

                    <div>
                      <p className="font-black">
                        {check.label}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {check.detail}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="klyx-card mt-6 p-6">
              <div className="flex items-center gap-3">
                <CreditCard
                  size={23}
                  className="text-violet-600 dark:text-violet-400"
                />
                <h2 className="text-xl font-black">
                  Parcours obligatoire
                </h2>
              </div>

              <ol className="mt-5 grid gap-3 sm:grid-cols-2">
                {data.flow.map((step, index) => (
                  <li
                    key={step}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-background/70 p-4"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-600 text-sm font-black text-white">
                      {index + 1}
                    </span>
                    <span className="text-sm font-bold">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good: boolean;
}) {
  return (
    <div className="klyx-card p-5">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-2 text-3xl font-black ${
          good
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-red-600 dark:text-red-400"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
