"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  MapPinned,
  RefreshCw,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  formatKlyxProviderReadinessCompleted,
  translateKlyxProviderReadiness,
  type KlyxProviderReadinessMessageKey,
} from "@/lib/klyx-provider-readiness-i18n";
import { supabase } from "@/lib/supabase";

type StudioData = {
  providerProfile?: {
    isPublished?: boolean;
    verificationStatus?: string;
  };
  services?: Array<{
    userServiceId?: string | null;
    enabled?: boolean;
    title?: string;
    description?: string;
    price?: number | null;
    availability?: Array<{
      enabled?: boolean;
    }>;
  }>;
};

type ZonesData = {
  zones?: Array<{
    is_active?: boolean;
    user_service_id?: string;
  }>;
};

type ReadinessItem = {
  label: string;
  done: boolean;
  href: string;
};

export default function ProviderReadinessStatus() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxProviderReadinessMessageKey) =>
    translateKlyxProviderReadiness(locale, key);

  const [studio, setStudio] = useState<StudioData | null>(null);
  const [zones, setZones] = useState<ZonesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);

  const load = useCallback(async (manual = false) => {
    manual ? setRefreshing(true) : setLoading(true);
    setHasError(false);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Provider readiness unavailable");
      }

      const headers = {
        Authorization: `Bearer ${session.access_token}`,
      };

      const [studioResponse, zonesResponse] = await Promise.all([
        fetch("/api/provider/studio", {
          cache: "no-store",
          headers,
        }),
        fetch("/api/provider/zones", {
          cache: "no-store",
          headers,
        }),
      ]);

      const studioBody = (await studioResponse.json()) as StudioData & {
        data?: StudioData;
      };
      const zonesBody = (await zonesResponse.json()) as ZonesData;

      if (!studioResponse.ok || !zonesResponse.ok) {
        throw new Error("Provider readiness unavailable");
      }

      setStudio(studioBody.data ?? studioBody);
      setZones(zonesBody);
    } catch {
      setHasError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const items = useMemo<ReadinessItem[]>(() => {
    const services = Array.isArray(studio?.services) ? studio.services : [];
    const enabledServices = services.filter((service) => service.enabled === true);

    const hasCompleteService =
      enabledServices.length > 0 &&
      enabledServices.every((service) => {
        const hasAvailability =
          Array.isArray(service.availability) &&
          service.availability.some((day) => day.enabled);

        return Boolean(
          (service.title ?? "").trim().length >= 5 &&
            (service.description ?? "").trim().length >= 30 &&
            service.price !== null &&
            service.price !== undefined &&
            hasAvailability
        );
      });

    const activeZoneUserServiceIds = new Set(
      (Array.isArray(zones?.zones) ? zones.zones : [])
        .filter(
          (zone) =>
            zone.is_active !== false &&
            typeof zone.user_service_id === "string" &&
            zone.user_service_id.length > 0
        )
        .map((zone) => zone.user_service_id as string)
    );

    const hasZone =
      enabledServices.length > 0 &&
      enabledServices.every(
        (service) =>
          typeof service.userServiceId === "string" &&
          service.userServiceId.length > 0 &&
          activeZoneUserServiceIds.has(service.userServiceId)
      );

    const isPublished = studio?.providerProfile?.isPublished === true;
    const isVerified = studio?.providerProfile?.verificationStatus === "verified";

    return [
      {
        label: t("publishedProfile"),
        done: isPublished,
        href: "/provider/studio",
      },
      {
        label: t("completeService"),
        done: hasCompleteService,
        href: "/provider/studio",
      },
      {
        label: t("activeZone"),
        done: Boolean(hasZone),
        href: "/provider/zones",
      },
      {
        label: t("verifiedIdentity"),
        done: isVerified,
        href: "/provider/verification",
      },
    ];
  }, [locale, studio, zones]);

  const mandatoryItems = items.slice(0, 3);
  const mandatoryReady =
    mandatoryItems.length > 0 && mandatoryItems.every((item) => item.done);
  const nextMandatoryItem = mandatoryItems.find((item) => !item.done) ?? null;
  const completed = items.filter((item) => item.done).length;

  const primaryAction = mandatoryReady
    ? { href: "/provider/jobs", label: t("viewMissions") }
    : nextMandatoryItem;

  return (
    <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${
              loading
                ? "bg-muted text-muted-foreground"
                : mandatoryReady
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
            }`}
          >
            {loading ? (
              <LoaderCircle size={20} className="animate-spin" />
            ) : mandatoryReady ? (
              <CheckCircle2 size={20} />
            ) : (
              <CircleAlert size={20} />
            )}
          </span>

          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {t("visibility")}
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
              {loading ? t("checking") : mandatoryReady ? t("ready") : t("incomplete")}
            </h2>
            {!loading && !hasError && (
              <p className="mt-2 text-sm text-muted-foreground">
                {formatKlyxProviderReadinessCompleted(locale, completed)}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void load(true)}
          disabled={refreshing}
          aria-label={t("refresh")}
          title={t("refresh")}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center self-start rounded-xl border border-border bg-background text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-wait disabled:opacity-60"
        >
          {refreshing ? (
            <LoaderCircle size={17} className="animate-spin" />
          ) : (
            <RefreshCw size={17} />
          )}
        </button>
      </div>

      {hasError && !loading && (
        <div className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
          {t("genericError")}
        </div>
      )}

      {!loading && !hasError && primaryAction && (
        <div className="mt-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {t("nextAction")}
          </p>
          <Link
            href={primaryAction.href}
            prefetch
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#2563EB] px-5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            {primaryAction.label}
            <ArrowRight size={17} />
          </Link>
        </div>
      )}

      {!loading && !hasError && (
        <details className="group mt-5 border-t border-border pt-4">
          <summary className="cursor-pointer list-none text-sm font-semibold text-muted-foreground transition hover:text-foreground">
            {t("details")}
          </summary>

          <div className="mt-4 space-y-2">
            {items.map((item, index) => {
              const Icon =
                index === 0
                  ? ShieldCheck
                  : index === 1
                    ? Wrench
                    : index === 2
                      ? MapPinned
                      : ShieldCheck;

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  prefetch
                  className="flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2 text-sm transition hover:bg-muted/60"
                >
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${
                      item.done
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {item.done ? <CheckCircle2 size={16} /> : <Icon size={16} />}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.done ? t("done") : t("todo")}
                  </span>
                </Link>
              );
            })}

            <Link
              href="/onboarding"
              className="mt-3 flex min-h-11 items-center justify-between gap-3 border-t border-border px-3 pt-4 text-sm font-semibold text-muted-foreground transition hover:text-[#2563EB]"
            >
              <span>{t("finishSetup")}</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </details>
      )}

      {/* KLYX_AI_FIRST_PROVIDER_READINESS_15_02 */}
    </section>
  );
}
