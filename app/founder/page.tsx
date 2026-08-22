"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Crown,
  LoaderCircle,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AccountType = "client" | "provider";
type Profile = {
  id: string;
  firstName: string;
  lastName: string;
  city: string;
  accountType: AccountType;
  avatarUrl: string | null;
};
type FounderStatus = {
  isFounder?: boolean;
  activeProfileId?: string | null;
  clientProfiles?: Profile[];
  providerProfiles?: Profile[];
  error?: string;
};

export default function FounderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState("");
  const [status, setStatus] = useState<FounderStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    fetch("/api/founder/status", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as FounderStatus;
        if (!response.ok || !body.isFounder) {
          throw new Error(body.error || "Accès Founder refusé.");
        }
        if (mounted) setStatus(body);
      })
      .catch((e) => {
        if (mounted) setError(e instanceof Error ? e.message : "Chargement impossible.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function switchProfile(profile: Profile, destination: string) {
    setSwitching(profile.id);
    setError("");
    try {
      const response = await fetch("/api/profiles/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: profile.id }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Changement impossible.");
      router.push(destination);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Changement impossible.");
    } finally {
      setSwitching("");
    }
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background">
        <LoaderCircle className="animate-spin" size={38} />
      </main>
    );
  }

  if (!status?.isFounder) {
    return (
      <main className="min-h-screen bg-background px-5 py-10 text-foreground">
        <div className="mx-auto max-w-3xl rounded-3xl border border-rose-500/20 bg-rose-500/10 p-8">
          <ShieldCheck className="text-rose-500" size={34} />
          <h1 className="mt-5 text-2xl font-black">Accès Founder refusé</h1>
          <p className="mt-3 text-sm text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }

  const client = status.clientProfiles?.[0] ?? null;
  const provider = status.providerProfiles?.[0] ?? null;

  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-8">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-[2rem] bg-[linear-gradient(135deg,#17131f,#35165e_52%,#111827)] p-8 text-white">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em]">
            <Crown size={15} /> Founder Access
          </div>
          <h1 className="mt-5 text-4xl font-black">Console Founder KLYX</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
            Une seule connexion pour tester KLYX comme client, prestataire et administrateur.
          </p>
        </section>

        {error && (
          <div className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-600">
            {error}
          </div>
        )}

        <section className="mt-8 grid gap-5 lg:grid-cols-3">
          <ModeCard
            icon={<UserRound size={24} />}
            title="Mode Client"
            description="Recherche, devis, réservation, paiement, messages et suivi."
            active={client?.id === status.activeProfileId}
            loading={switching === client?.id}
            action={client ? () => void switchProfile(client, "/dashboard") : undefined}
            href="/accounts?new=1&type=client"
            label={client ? "Entrer comme client" : "Créer un profil client"}
          />

          <ModeCard
            icon={<BriefcaseBusiness size={24} />}
            title="Mode Prestataire"
            description="Prestations, devis, planning, zones, vérifications et paiements."
            active={provider?.id === status.activeProfileId}
            loading={switching === provider?.id}
            action={provider ? () => void switchProfile(provider, "/provider") : undefined}
            href="/accounts?new=1&type=provider"
            label={provider ? "Entrer comme prestataire" : "Créer un profil prestataire"}
          />

          <article className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <ShieldCheck className="text-violet-600" size={24} />
            <h2 className="mt-5 text-xl font-black">Super Admin</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Centre Admin, vérifications, compétences, litiges, finance et contrôle du lancement.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                href="/admin"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-black text-white"
              >
                Ouvrir Admin <ArrowRight size={16} />
              </Link>
              <Link
                href="/founder/analytics"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-black"
              >
                <BarChart3 size={16} /> Analytics produit
              </Link>
            </div>
          </article>
        </section>

        <section className="mt-8 rounded-3xl border border-amber-500/20 bg-amber-500/10 p-6">
          <h2 className="font-black">Sumsub : mode attente</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Le compte Founder peut tester KLYX, mais aucune identité non vérifiée n’est présentée publiquement comme vérifiée.
          </p>
        </section>
      </div>
    </main>
  );
}

function ModeCard({
  icon,
  title,
  description,
  active,
  loading,
  action,
  href,
  label,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  active: boolean;
  loading: boolean;
  action?: () => void;
  href: string;
  label: string;
}) {
  return (
    <article className="rounded-3xl border border-border bg-card p-6 shadow-sm">
      <div className="text-violet-600">{icon}</div>
      <div className="mt-5 flex items-center gap-2">
        <h2 className="text-xl font-black">{title}</h2>
        {active && (
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-black text-emerald-600">
            ACTIF
          </span>
        )}
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
      {action ? (
        <button
          type="button"
          onClick={action}
          disabled={loading}
          className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-black text-white disabled:opacity-60"
        >
          {loading ? (
            <LoaderCircle className="animate-spin" size={16} />
          ) : (
            <ArrowRight size={16} />
          )}
          {label}
        </button>
      ) : (
        <Link
          href={href}
          className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-black"
        >
          {label} <ArrowRight size={16} />
        </Link>
      )}
    </article>
  );
}
