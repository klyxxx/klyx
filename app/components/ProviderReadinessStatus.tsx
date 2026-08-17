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
import { supabase } from "@/lib/supabase";

type StudioData = {
  providerProfile?: {
    isPublished?: boolean;
    verificationStatus?: string;
  };
  services?: Array<{
    enabled?: boolean;
    title?: string;
    description?: string;
    price?: number | null;
    city?: string;
    serviceArea?: string[];
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
  const [studio, setStudio] = useState<StudioData | null>(null);
  const [zones, setZones] = useState<ZonesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async (manual = false) => {
    manual ? setRefreshing(true) : setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Session manquante.");
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
        error?: string;
      };

      const zonesBody = (await zonesResponse.json()) as ZonesData & {
        error?: string;
      };

      if (!studioResponse.ok) {
        throw new Error(
          studioBody.error || "Impossible de charger le profil prestataire."
        );
      }

      if (!zonesResponse.ok) {
        throw new Error(
          zonesBody.error || "Impossible de charger les zones."
        );
      }

      setStudio(studioBody.data ?? studioBody);
      setZones(zonesBody);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de vérifier le statut prestataire."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const items = useMemo<ReadinessItem[]>(() => {
    const services = Array.isArray(studio?.services) ? studio?.services : [];

    const hasCompleteService = services.some((service) => {
      const hasAvailability =
        Array.isArray(service.availability) &&
        service.availability.some((day) => day.enabled);

      return Boolean(
        service.enabled &&
          (service.title ?? "").trim().length >= 5 &&
          (service.description ?? "").trim().length >= 30 &&
          service.price !== null &&
          service.price !== undefined &&
          (service.city ?? "").trim().length > 0 &&
          Array.isArray(service.serviceArea) &&
          service.serviceArea.length > 0 &&
          hasAvailability
      );
    });

    const hasZone =
      Array.isArray(zones?.zones) &&
      zones.zones.some((zone) => zone.is_active !== false);

    const isPublished = studio?.providerProfile?.isPublished === true;

    const isVerified =
      studio?.providerProfile?.verificationStatus === "verified";

    return [
      {
        label: "Profil professionnel publié",
        done: isPublished,
        href: "/provider",
      },
      {
        label: "Service complet et disponible",
        done: hasCompleteService,
        href: "/provider",
      },
      {
        label: "Zone d’intervention active",
        done: Boolean(hasZone),
        href: "/provider/zones",
      },
      {
        label: "Identité vérifiée",
        done: isVerified,
        href: "/provider/verification",
      },
    ];
  }, [studio, zones]);

  const mandatoryItems = items.slice(0, 3);
  const mandatoryReady =
    mandatoryItems.length > 0 &&
    mandatoryItems.every((item) => item.done);

  const verified = items[3]?.done === true;

  const completed = items.filter((item) => item.done).length;

  return (
    <section className="mb-6">
      <div
        className={`overflow-hidden rounded-[1.75rem] border p-5 sm:p-6 ${
          mandatoryReady
            ? "border-emerald-500/25 bg-emerald-500/[0.08]"
            : "border-amber-500/25 bg-amber-500/[0.08]"
        }`}
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <span
              className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${
                mandatoryReady
                  ? "bg-emerald-600 text-white"
                  : "bg-amber-500 text-zinc-950"
              }`}
            >
              {loading ? (
                <LoaderCircle size={21} className="animate-spin" />
              ) : mandatoryReady ? (
                <CheckCircle2 size={22} />
              ) : (
                <CircleAlert size={22} />
              )}
            </span>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                Visibilité
              </p>

              <h2 className="mt-1 text-xl font-black sm:text-2xl">
                {loading
                  ? "Vérification de ton activité..."
                  : mandatoryReady
                    ? "Prêt à apparaître dans les recherches"
                    : "Configuration encore incomplète"}
              </h2>
              {/* KLYX_AI_FIRST_PROVIDER_READINESS_15_02 */}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 text-sm font-black transition hover:bg-muted disabled:cursor-wait disabled:opacity-60"
          >
            {refreshing ? (
              <LoaderCircle size={17} className="animate-spin" />
            ) : (
              <RefreshCw size={17} />
            )}
            Actualiser
          </button>
        </div>

        {!loading && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                  className="rounded-2xl border border-border/80 bg-background/70 p-4 transition hover:bg-background"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`grid h-9 w-9 place-items-center rounded-xl ${
                        item.done
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {item.done ? <CheckCircle2 size={17} /> : <Icon size={17} />}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black">
                        {item.label}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.done ? "Terminé" : "À compléter"}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
            {errorMessage}
          </div>
        )}

        {!loading && (
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
            <span className="font-black">
              {completed}/4 éléments complétés
            </span>

            {!mandatoryReady && (
              <Link
                href="/onboarding"
                prefetch
                className="inline-flex items-center gap-2 font-black text-blue-600 dark:text-blue-400"
              >
                Terminer ma configuration
                <ArrowRight size={16} />
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
