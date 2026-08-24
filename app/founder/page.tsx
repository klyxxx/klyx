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
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  translateKlyxFounderHome,
  type KlyxFounderHomeMessageKey,
} from "@/lib/klyx-founder-home-i18n";

// KLYX_FOUNDER_HOME_I18N

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
};

export default function FounderPage() {
  const router = useRouter();
  const { locale } = useKlyxLocale();
  const t = (key: KlyxFounderHomeMessageKey) => translateKlyxFounderHome(locale, key);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState("");
  const [status, setStatus] = useState<FounderStatus | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch("/api/founder/status", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as FounderStatus;
        if (!response.ok || !body.isFounder) {
          if (mounted) setLoadFailed(true);
          return;
        }
        if (mounted) setStatus(body);
      })
      .catch(() => {
        if (mounted) setLoadFailed(true);
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
    setLoadFailed(false);
    try {
      const response = await fetch("/api/profiles/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: profile.id }),
      });
      await response.json().catch(() => ({}));
      if (!response.ok) {
        setLoadFailed(true);
        return;
      }
      router.push(destination);
      router.refresh();
    } catch {
      setLoadFailed(true);
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
          <h1 className="mt-5 text-2xl font-black">{t("accessDenied")}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{t("loadError")}</p>
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
            <Crown size={15} /> {t("badge")}
          </div>
          <h1 className="mt-5 text-4xl font-black">{t("title")}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">{t("description")}</p>
        </section>

        {loadFailed && (
          <div className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-600">
            {t("loadError")}
          </div>
        )}

        <section className="mt-8 grid gap-5 lg:grid-cols-3">
          <ModeCard
            icon={<UserRound size={24} />}
            title={t("clientTitle")}
            description={t("clientDescription")}
            activeLabel={t("active")}
            active={client?.id === status.activeProfileId}
            loading={switching === client?.id}
            action={client ? () => void switchProfile(client, "/dashboard") : undefined}
            href="/accounts?new=1&type=client"
            label={client ? t("enterClient") : t("createClient")}
          />

          <ModeCard
            icon={<BriefcaseBusiness size={24} />}
            title={t("providerTitle")}
            description={t("providerDescription")}
            activeLabel={t("active")}
            active={provider?.id === status.activeProfileId}
            loading={switching === provider?.id}
            action={provider ? () => void switchProfile(provider, "/provider") : undefined}
            href="/accounts?new=1&type=provider"
            label={provider ? t("enterProvider") : t("createProvider")}
          />

          <article className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <ShieldCheck className="text-violet-600" size={24} />
            <h2 className="mt-5 text-xl font-black">{t("adminTitle")}</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{t("adminDescription")}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                href="/admin"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-black text-white"
              >
                {t("openAdmin")} <ArrowRight size={16} />
              </Link>
              <Link
                href="/founder/analytics"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-black"
              >
                <BarChart3 size={16} /> {t("analytics")}
              </Link>
            </div>
          </article>
        </section>

        <section className="mt-8 rounded-3xl border border-amber-500/20 bg-amber-500/10 p-6">
          <h2 className="font-black">{t("sumsubTitle")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("sumsubDescription")}</p>
        </section>
      </div>
    </main>
  );
}

function ModeCard({
  icon,
  title,
  description,
  activeLabel,
  active,
  loading,
  action,
  href,
  label,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  activeLabel: string;
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
            {activeLabel}
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
