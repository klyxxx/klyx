"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  Rocket,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";

type CheckStatus = "ok" | "warning" | "error";

type LaunchCheck = {
  id: string;
  title: string;
  description: string;
  href?: string;
  status: CheckStatus;
  detail: string;
  blocking: boolean;
};

type Probe = {
  id: string;
  title: string;
  description: string;
  path: string;
  blocking: boolean;
  auth?: boolean;
  optional?: boolean;
};

const PROBES: Probe[] = [
  {
    id: "home",
    title: "Accueil public",
    description: "La porte d’entrée KLYX répond.",
    path: "/",
    blocking: true,
  },
  {
    id: "login",
    title: "Connexion",
    description: "La page de connexion est accessible.",
    path: "/login",
    blocking: true,
  },
  {
    id: "signup",
    title: "Inscription",
    description: "La création de compte est accessible.",
    path: "/signup",
    blocking: true,
  },
  {
    id: "install",
    title: "Installation PWA",
    description: "La page Installer KLYX est accessible.",
    path: "/install",
    blocking: true,
  },
  {
    id: "manifest",
    title: "Manifest PWA",
    description: "Le manifest de l’application est servi.",
    path: "/manifest.webmanifest",
    blocking: true,
  },
  {
    id: "service-worker",
    title: "Service worker",
    description: "Le service worker KLYX est disponible.",
    path: "/sw.js",
    blocking: true,
  },
  {
    id: "offline",
    title: "Mode hors ligne",
    description: "La page de secours hors ligne est disponible.",
    path: "/offline",
    blocking: true,
  },
  {
    id: "verifications",
    title: "Vérifications prestataires",
    description: "Le centre de vérification admin répond.",
    path: "/api/admin/verifications",
    blocking: true,
    auth: true,
  },
  {
    id: "skills",
    title: "Validation des compétences",
    description: "Le contrôle métier par métier répond.",
    path: "/api/admin/skill-verifications",
    blocking: true,
    auth: true,
  },
  {
    id: "stripe",
    title: "Stripe / paiements",
    description: "Le contrôle de préparation Stripe répond.",
    path: "/api/admin/stripe-readiness",
    blocking: true,
    auth: true,
  },
  {
    id: "sumsub",
    title: "Sumsub",
    description:
      "Vérification externe optionnelle pour le lancement actuel.",
    path: "/api/admin/sumsub",
    blocking: false,
    auth: true,
    optional: true,
  },
];

function statusClass(status: CheckStatus) {
  if (status === "ok") {
    return "border-emerald-500/20 bg-emerald-500/10";
  }

  if (status === "warning") {
    return "border-amber-500/20 bg-amber-500/10";
  }

  return "border-rose-500/20 bg-rose-500/10";
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "ok") {
    return (
      <CheckCircle2
        size={20}
        className="text-emerald-500"
      />
    );
  }

  return (
    <CircleAlert
      size={20}
      className={
        status === "warning"
          ? "text-amber-500"
          : "text-rose-500"
      }
    />
  );
}

export default function AdminLaunchPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [checks, setChecks] = useState<LaunchCheck[]>([]);

  const runAudit = useCallback(async () => {
    setRunning(true);
    setError("");

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Session manquante.");
      }

      const accessResponse = await fetch("/api/admin/access", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const accessBody = (await accessResponse.json()) as {
        isAdmin?: boolean;
        error?: string;
      };

      if (!accessResponse.ok || !accessBody.isAdmin) {
        throw new Error(
          accessBody.error || "Accès administrateur refusé."
        );
      }

      setAllowed(true);

      const results = await Promise.all(
        PROBES.map(async (probe): Promise<LaunchCheck> => {
          try {
            const response = await fetch(probe.path, {
              cache: "no-store",
              headers: probe.auth
                ? {
                    Authorization: `Bearer ${session.access_token}`,
                  }
                : undefined,
            });

            const ok =
              response.status >= 200 && response.status < 400;

            if (ok) {
              return {
                id: probe.id,
                title: probe.title,
                description: probe.description,
                href: probe.path,
                status: "ok",
                detail: `HTTP ${response.status}`,
                blocking: probe.blocking,
              };
            }

            return {
              id: probe.id,
              title: probe.title,
              description: probe.description,
              href: probe.path,
              status: probe.optional ? "warning" : "error",
              detail: `HTTP ${response.status}`,
              blocking: probe.blocking,
            };
          } catch (probeError) {
            return {
              id: probe.id,
              title: probe.title,
              description: probe.description,
              href: probe.path,
              status: probe.optional ? "warning" : "error",
              detail:
                probeError instanceof Error
                  ? probeError.message
                  : "Échec du contrôle.",
              blocking: probe.blocking,
            };
          }
        })
      );

      setChecks(results);
    } catch (auditError) {
      setAllowed(false);
      setError(
        auditError instanceof Error
          ? auditError.message
          : "Audit impossible."
      );
    } finally {
      setRunning(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void runAudit();
  }, [runAudit]);

  const summary = useMemo(() => {
    const blocking = checks.filter((item) => item.blocking);
    const blockingErrors = blocking.filter(
      (item) => item.status === "error"
    ).length;
    const ok = checks.filter((item) => item.status === "ok").length;
    const warnings = checks.filter(
      (item) => item.status === "warning"
    ).length;

    return {
      ready: checks.length > 0 && blockingErrors === 0,
      ok,
      warnings,
      blockingErrors,
    };
  }, [checks]);

  if (loading) {
    return (
      <main className="klyx-page grid min-h-screen place-items-center">
        <LoaderCircle size={38} className="animate-spin" />
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="klyx-page">
        <div className="mx-auto max-w-3xl">
          <section className="klyx-card p-8">
            <ShieldCheck size={34} className="text-rose-500" />
            <h1 className="mt-5 text-2xl font-black">
              Accès administrateur refusé
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {error || "Accès impossible."}
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft size={17} />
          Centre Admin
        </Link>

        <section className="mt-6 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#17131f,#2b1452_52%,#111827)] p-8 text-white">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em]">
            <Rocket size={15} />
            Étape 11
          </div>

          <h1 className="mt-5 text-3xl font-black tracking-[-0.045em] sm:text-5xl">
            Centre de lancement KLYX
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
            Cette page contrôle les briques essentielles du lancement.
            Un avertissement optionnel ne bloque pas KLYX. Une erreur sur
            un contrôle obligatoire doit être corrigée avant ouverture.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void runAudit()}
              disabled={running}
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-zinc-950 disabled:opacity-60"
            >
              {running ? (
                <LoaderCircle size={18} className="animate-spin" />
              ) : (
                <RefreshCw size={18} />
              )}
              Relancer l’audit
            </button>
          </div>
        </section>

        <section
          className={`mt-6 rounded-2xl border p-6 ${
            summary.ready
              ? "border-emerald-500/20 bg-emerald-500/10"
              : "border-rose-500/20 bg-rose-500/10"
          }`}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                État global
              </p>
              <h2 className="mt-2 text-2xl font-black">
                {summary.ready
                  ? "Socle de lancement prêt"
                  : "Blocage avant lancement"}
              </h2>
            </div>

            <span
              className={`rounded-full px-4 py-2 text-sm font-black ${
                summary.ready
                  ? "bg-emerald-500/15 text-emerald-600"
                  : "bg-rose-500/15 text-rose-600"
              }`}
            >
              {summary.ready ? "READY" : "NOT READY"}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Metric label="OK" value={summary.ok} />
            <Metric label="Avertissements" value={summary.warnings} />
            <Metric
              label="Blocages"
              value={summary.blockingErrors}
            />
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {checks.map((check) => (
            <article
              key={check.id}
              className={`rounded-2xl border p-5 ${statusClass(
                check.status
              )}`}
            >
              <div className="flex items-start gap-3">
                <StatusIcon status={check.status} />

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-black">{check.title}</h2>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {check.description}
                      </p>
                    </div>

                    {!check.blocking && (
                      <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-black text-amber-600">
                        OPTIONNEL
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-xs font-bold text-muted-foreground">
                      {check.detail}
                    </span>

                    {check.href && !check.href.startsWith("/api/") && (
                      <Link
                        href={check.href}
                        className="inline-flex items-center gap-1 text-xs font-black text-violet-600"
                      >
                        Ouvrir
                        <ExternalLink size={13} />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className="klyx-card mt-8 p-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
            Règle de lancement
          </p>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            KLYX peut continuer vers les derniers tests utilisateurs quand
            tous les contrôles obligatoires sont verts. Sumsub reste
            volontairement non bloquant tant que cette intégration externe
            n’est pas activée.
          </p>
        </section>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/50 p-4">
      <p className="text-xs font-bold text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}
