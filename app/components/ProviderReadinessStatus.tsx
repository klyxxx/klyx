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
        href: "/provider",
      },
      {
        label: t("completeService"),
        done: hasCompleteService,
        href: "/provider",
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
  const completed = items.filter((item) => item.done).length;

  return (
    <section className="mb-6">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <span
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
                mandatoryReady
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-blue-600/8 text-blue-600"
              }`}
            >
              {loading ? (
                <LoaderCircle size={20} className="animate-spin" />
              ) : mandatoryReady ? (
                <CheckCircle2 size={21} />
              ) : (
                <CircleAlert size={21} />
              )}
            </span>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
                {t("visibility")}
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] sm:text-2xl">
                {loading
                  ? t("checking")
                  : mandatoryReady
                    ? t("ready")
                    : t("incomplete")}
              </h2>
              {/* KLYX_AI_FIRST_PROVIDER_READINESS_15_02 */}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold transition hover:bg-muted disabled:cursor-wait disabled:opacity-60"
          >
            {refreshing ? (
              <LoaderCircle size={17} className="animate-spin" />
            ) : (
              <RefreshCw size={17} />
            )}
            {t("refresh")}
          </button>
        </div>

        {!loading && (
          <div className="mt-5 grid overflow-hidden rounded-2xl border border-border sm:grid-cols-2 xl:grid-cols-4">
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
                  className={`p-4 transition hover:bg-muted/60 ${
                    index > 0 ? "border-t border-border sm:border-t-0 sm:border-l" : ""
                  } ${index === 2 ? "sm:border-l-0 xl:border-l" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`grid h-9 w-9 place-items-center rounded-xl ${
                        item.done
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-blue-600/8 text-blue-600"
                      }`}
                    >
                      {item.done ? <CheckCircle2 size={17} /> : <Icon size={17} />}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{item.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.done ? t("done") : t("todo")}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {hasError && (
          <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/8 p-4 text-sm text-rose-700 dark:text-rose-300">
            {t("genericError")}
          </div>
        )}

        {!loading && (
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
            <span className="font-semibold">
              {formatKlyxProviderReadinessCompleted(locale, completed)}
            </span>

            {!mandatoryReady && (
              <Link
                href="/onboarding"
                prefetch
                className="inline-flex items-center gap-2 font-semibold text-blue-600"
              >
                {t("finishSetup")}
                <ArrowRight size={16} />
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
