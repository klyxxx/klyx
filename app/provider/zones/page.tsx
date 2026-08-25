"use client";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
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

function serviceLabel(
  service: ProviderService,
  fallback: string
): string {
  const relation = Array.isArray(service.services)
    ? service.services[0]
    : service.services;

  return (
    service.custom_name ||
    relation?.name ||
    relation?.slug ||
    fallback
  );
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
      setUserServiceId(
        (current) => current || nextServices[0]?.id || ""
      );
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
    () =>
      BELGIAN_LOCALITIES.find(
        (item) => item.name === locality
      ) ?? null,
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
          translateKlyxProviderZoneApiCode(locale, body.code) ??
            t("addError")
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
    <main className="klyx-page">
      <div className="mx-auto max-w-6xl">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#111827,#164e63_52%,#0f172a)] p-7 text-white sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/70">
            <Navigation size={15} />
            {t("providerOnly")}
          </div>

          <h1 className="mt-5 text-3xl font-black sm:text-5xl">
            {t("title")}
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
            {t("description")}
          </p>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="mt-7 inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-zinc-950 disabled:opacity-50"
          >
            <RefreshCw size={17} />
            {t("refresh")}
          </button>
        </section>

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-rose-700 dark:text-rose-300">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mt-6 flex gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 size={19} />
            {successMessage}
          </div>
        )}

        <form
          onSubmit={addZone}
          className="klyx-card mt-8 p-6 sm:p-8"
        >
          <h2 className="text-2xl font-black">
            {t("addTitle")}
          </h2>

          {loading ? (
            <div className="grid min-h-44 place-items-center">
              <LoaderCircle
                className="animate-spin text-cyan-600"
                size={34}
              />
            </div>
          ) : services.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5 text-sm">
              {t("noServices")}
            </div>
          ) : (
            <>
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <label>
                  <span className="mb-2 block text-sm font-black">
                    {t("service")}
                  </span>
                  <KlyxSelect
                    value={userServiceId}
                    onChange={setUserServiceId}
                    options={services.map((service) => ({
                      value: service.id,
                      label: serviceLabel(
                        service,
                        t("serviceFallback")
                      ),
                    }))}
                    ariaLabel={t("service")}
                  />
                </label>

                <label>
                  <span className="mb-2 block text-sm font-black">
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
                  <span className="mb-2 block text-sm font-black">
                    {t("maxRadius")}
                  </span>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={radiusKm}
                      onChange={(event) =>
                        setRadiusKm(event.target.value)
                      }
                      className="klyx-input pr-14"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      km
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 rounded-2xl border border-border bg-background/60 p-4">
                  <input
                    type="checkbox"
                    checked={isPrimary}
                    onChange={(event) =>
                      setIsPrimary(event.target.checked)
                    }
                    className="mt-1 h-5 w-5 accent-cyan-600"
                  />
                  <div>
                    <p className="font-black">
                      {t("primary")}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {t("primaryDescription")}
                    </p>
                  </div>
                </label>
              </div>

              <button
                type="submit"
                disabled={
                  saving ||
                  !userServiceId ||
                  !selectedLocality
                }
                className="klyx-button mt-6 w-full"
              >
                {saving ? (
                  <LoaderCircle
                    className="animate-spin"
                    size={18}
                  />
                ) : (
                  <Plus size={18} />
                )}
                {t("addZone")}
              </button>
            </>
          )}
        </form>

        <section className="mt-8">
          <p className="klyx-eyebrow">
            {t("coverageEyebrow")}
          </p>
          <h2 className="mt-2 text-2xl font-black">
            {t("savedTitle")}
          </h2>

          {!loading && zones.length === 0 ? (
            <div className="klyx-card mt-5 p-8 text-center">
              <MapPin
                className="mx-auto text-cyan-600"
                size={40}
              />
              <p className="mt-4 font-black">
                {t("empty")}
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {zones.map((zone) => {
                const service = services.find(
                  (item) => item.id === zone.user_service_id
                );

                return (
                  <article
                    key={zone.id}
                    className="klyx-card p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-black">
                            {zone.locality}
                          </h3>
                          {zone.is_primary && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-black uppercase text-amber-700 dark:text-amber-300">
                              <Star size={12} />
                              {t("primaryBadge")}
                            </span>
                          )}
                        </div>

                        <p className="mt-2 text-sm text-muted-foreground">
                          {zone.postal_code ?? t("belgium")} · {t("radius")} {zone.radius_km} km
                        </p>
                        <p className="mt-1 text-sm font-black text-cyan-700 dark:text-cyan-300">
                          {service
                            ? serviceLabel(
                                service,
                                t("serviceFallback")
                              )
                            : t("serviceFallback")}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={busyId === zone.id}
                        onClick={() => void removeZone(zone.id)}
                        className="grid h-10 w-10 place-items-center rounded-xl border border-rose-500/25 text-rose-600 disabled:opacity-50"
                        aria-label={t("deleteAria")}
                      >
                        {busyId === zone.id ? (
                          <LoaderCircle
                            className="animate-spin"
                            size={16}
                          />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    </div>

                    {!zone.is_primary && (
                      <button
                        type="button"
                        disabled={busyId === zone.id}
                        onClick={() => void setPrimary(zone)}
                        className="mt-4 inline-flex items-center gap-2 text-xs font-black text-amber-700 dark:text-amber-300"
                      >
                        <Star size={15} />
                        {t("setPrimary")}
                      </button>
                    )}
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
