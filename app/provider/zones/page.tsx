"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  LoaderCircle,
  MapPin,
  Navigation,
  Plus,
  RefreshCw,
  Star,
  Trash2,
} from "lucide-react";

import KlyxSelect from "@/app/components/KlyxSelect";
import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import { BELGIAN_LOCALITIES } from "@/lib/belgian-localities";
import {
  translateKlyxProviderZoneApiCode,
  translateKlyxProviderZones,
  type KlyxProviderZonesMessageKey,
} from "@/lib/klyx-provider-zones-i18n";
import { supabase } from "@/lib/supabase";

type ProviderService = {
  id: string;
  custom_name: string | null;
  services:
    | {
        name: string | null;
        slug: string | null;
      }
    | {
        name: string | null;
        slug: string | null;
      }[]
    | null;
};

type Zone = {
  id: string;
  user_service_id: string;
  country_code: string;
  locality: string;
  postal_code: string | null;
  radius_km: number;
  is_primary: boolean;
  is_active: boolean;
};

type ApiBody = {
  services?: ProviderService[];
  zones?: Zone[];
  message?: string;
  error?: string;
  code?: string;
};

function serviceLabel(service: ProviderService, fallback: string): string {
  const relation = Array.isArray(service.services)
    ? service.services[0]
    : service.services;

  return service.custom_name || relation?.name || relation?.slug || fallback;
}

export default function ProviderZonesPage() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxProviderZonesMessageKey) =>
    translateKlyxProviderZones(locale, key);

  const [services, setServices] = useState<ProviderService[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [userServiceId, setUserServiceId] = useState("");
  const [locality, setLocality] = useState("");
  const [radiusKm, setRadiusKm] = useState("10");
  const [isPrimary, setIsPrimary] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function token(): Promise<string> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("KLYX_PROVIDER_ZONES_SESSION_MISSING");
    }

    return session.access_token;
  }

  async function load() {
    setLoading(true);
    setErrorMessage("");

    try {
      const accessToken = await token();
      const response = await fetch("/api/provider/zones", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const body = (await response.json()) as ApiBody;

      if (!response.ok) {
        setErrorMessage(t("loadError"));
        return;
      }

      const nextServices = body.services ?? [];
      setServices(nextServices);
      setZones(body.zones ?? []);
      setUserServiceId((current) => current || nextServices[0]?.id || "");
    } catch {
      setErrorMessage(t("loadError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const selectedLocality = useMemo(
    () => BELGIAN_LOCALITIES.find((item) => item.name === locality) ?? null,
    [locality]
  );

  async function addZone(event: FormEvent) {
    event.preventDefault();

    if (!userServiceId || !selectedLocality || saving) {
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const accessToken = await token();
      const response = await fetch("/api/provider/zones", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          userServiceId,
          locality: selectedLocality.name,
          postalCode: selectedLocality.postalCodes[0] ?? "",
          radiusKm: Number(radiusKm),
          isPrimary,
        }),
      });

      const body = (await response.json()) as ApiBody;

      if (!response.ok) {
        setErrorMessage(
          translateKlyxProviderZoneApiCode(locale, body.code) ?? t("addError")
        );
        return;
      }

      setSuccessMessage(t("added"));
      setLocality("");
      setRadiusKm("10");
      setIsPrimary(false);
      await load();
    } catch {
      setErrorMessage(t("addError"));
    } finally {
      setSaving(false);
    }
  }

  async function setPrimary(zone: Zone) {
    setBusyId(zone.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const accessToken = await token();
      const response = await fetch("/api/provider/zones", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          zoneId: zone.id,
          radiusKm: zone.radius_km,
          isPrimary: true,
          isActive: zone.is_active,
        }),
      });

      await response.json();

      if (!response.ok) {
        setErrorMessage(t("updateError"));
        return;
      }

      setSuccessMessage(t("primaryUpdated"));
      await load();
    } catch {
      setErrorMessage(t("updateError"));
    } finally {
      setBusyId("");
    }
  }

  async function removeZone(zoneId: string) {
    if (!window.confirm(t("confirmDelete"))) return;

    setBusyId(zoneId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const accessToken = await token();
      const response = await fetch("/api/provider/zones", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ zoneId }),
      });

      await response.json();

      if (!response.ok) {
        setErrorMessage(t("deleteError"));
        return;
      }

      setSuccessMessage(t("deleted"));
      await load();
    } catch {
      setErrorMessage(t("deleteError"));
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400">
              <Navigation size={17} />
              <span>{t("providerOnly")}</span>
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] sm:text-5xl">
              {t("title")}
            </h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
              {t("description")}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold transition hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            {t("refresh")}
          </button>
        </header>

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-red-500/25 bg-red-500/8 p-4 text-red-700 dark:text-red-300">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mt-6 flex gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/8 p-4 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 size={19} />
            {successMessage}
          </div>
        )}

        <form
          onSubmit={addZone}
          className="mt-8 overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
        >
          <div className="border-b border-border p-5 sm:p-6">
            <h2 className="text-xl font-semibold">{t("addTitle")}</h2>
          </div>

          {loading ? (
            <div className="grid min-h-44 place-items-center">
              <LoaderCircle className="animate-spin text-blue-600" size={34} />
            </div>
          ) : services.length === 0 ? (
            <div className="m-5 rounded-xl border border-amber-500/25 bg-amber-500/8 p-5 text-sm sm:m-6">
              {t("noServices")}
            </div>
          ) : (
            <div className="p-5 sm:p-6">
              <div className="grid gap-5 md:grid-cols-2">
                <label>
                  <span className="mb-2 block text-sm font-semibold">
                    {t("service")}
                  </span>
                  <KlyxSelect
                    value={userServiceId}
                    onChange={setUserServiceId}
                    options={services.map((service) => ({
                      value: service.id,
                      label: serviceLabel(service, t("serviceFallback")),
                    }))}
                    ariaLabel={t("service")}
                  />
                </label>

                <label>
                  <span className="mb-2 block text-sm font-semibold">
                    {t("locality")}
                  </span>
                  <KlyxSelect
                    value={locality}
                    onChange={setLocality}
                    placeholder={t("selectLocality")}
                    options={BELGIAN_LOCALITIES.map((item) => ({
                      value: item.name,
                      label: `${item.name} · ${item.postalCodes.join(", ")} · ${item.region}`,
                    }))}
                    ariaLabel={t("locality")}
                  />
                </label>

                <label>
                  <span className="mb-2 block text-sm font-semibold">
                    {t("maxRadius")}
                  </span>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={radiusKm}
                      onChange={(event) => setRadiusKm(event.target.value)}
                      className="klyx-input pr-14"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      km
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 rounded-xl border border-border bg-background p-4">
                  <input
                    type="checkbox"
                    checked={isPrimary}
                    onChange={(event) => setIsPrimary(event.target.checked)}
                    className="mt-1 h-5 w-5 accent-blue-600"
                  />
                  <div>
                    <p className="font-semibold">{t("primary")}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {t("primaryDescription")}
                    </p>
                  </div>
                </label>
              </div>

              <button
                type="submit"
                disabled={saving || !userServiceId || !selectedLocality}
                className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
              >
                {saving ? (
                  <LoaderCircle className="animate-spin" size={18} />
                ) : (
                  <Plus size={18} />
                )}
                {t("addZone")}
              </button>
            </div>
          )}
        </form>

        <section className="mt-10">
          <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
            {t("coverageEyebrow")}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
            {t("savedTitle")}
          </h2>

          {!loading && zones.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-blue-600/8 text-blue-600">
                <MapPin size={22} />
              </span>
              <p className="mt-4 font-semibold">{t("empty")}</p>
            </div>
          ) : (
            <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              {zones.map((zone, index) => {
                const service = services.find(
                  (item) => item.id === zone.user_service_id
                );

                return (
                  <article
                    key={zone.id}
                    className={`flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6 ${
                      index > 0 ? "border-t border-border" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold">{zone.locality}</h3>
                        {zone.is_primary && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-600/8 px-2.5 py-1 text-[10px] font-semibold uppercase text-blue-700 dark:text-blue-300">
                            <Star size={12} />
                            {t("primaryBadge")}
                          </span>
                        )}
                      </div>

                      <p className="mt-2 text-sm text-muted-foreground">
                        {zone.postal_code ?? t("belgium")} · {t("radius")} {zone.radius_km} km
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground/80">
                        {service
                          ? serviceLabel(service, t("serviceFallback"))
                          : t("serviceFallback")}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {!zone.is_primary && (
                        <button
                          type="button"
                          disabled={busyId === zone.id}
                          onClick={() => void setPrimary(zone)}
                          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-xs font-semibold text-blue-600 transition hover:bg-muted disabled:opacity-50"
                        >
                          <Star size={15} />
                          {t("setPrimary")}
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={busyId === zone.id}
                        onClick={() => void removeZone(zone.id)}
                        className="grid h-10 w-10 place-items-center rounded-xl border border-red-500/25 text-red-600 transition hover:bg-red-500/5 disabled:opacity-50"
                        aria-label={t("deleteAria")}
                      >
                        {busyId === zone.id ? (
                          <LoaderCircle className="animate-spin" size={16} />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
