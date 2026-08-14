"use client";

import {
  FormEvent,
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
import { supabase } from "@/lib/supabase";
import { BELGIAN_LOCALITIES } from "@/lib/belgian-localities";

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

function serviceLabel(service: ProviderService): string {
  const relation = Array.isArray(service.services)
    ? service.services[0]
    : service.services;

  return (
    service.custom_name ||
    relation?.name ||
    relation?.slug ||
    "Métier KLYX"
  );
}

export default function ProviderZonesPage() {
  const [services, setServices] = useState<
    ProviderService[]
  >([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [userServiceId, setUserServiceId] =
    useState("");
  const [locality, setLocality] = useState("");
  const [radiusKm, setRadiusKm] = useState("10");
  const [isPrimary, setIsPrimary] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [errorMessage, setErrorMessage] =
    useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  async function token(): Promise<string> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Session manquante.");
    }

    return session.access_token;
  }

  async function load() {
    setLoading(true);
    setErrorMessage("");

    try {
      const accessToken = await token();
      const response = await fetch(
        "/api/provider/zones",
        {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const body = (await response.json()) as {
        services?: ProviderService[];
        zones?: Zone[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          body.error || "Chargement impossible."
        );
      }

      const nextServices = body.services ?? [];
      setServices(nextServices);
      setZones(body.zones ?? []);

      if (!userServiceId && nextServices[0]?.id) {
        setUserServiceId(nextServices[0].id);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de charger les zones."
      );
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

    if (
      !userServiceId ||
      !selectedLocality ||
      saving
    ) {
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const accessToken = await token();
      const response = await fetch(
        "/api/provider/zones",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            userServiceId,
            locality: selectedLocality.name,
            postalCode:
              selectedLocality.postalCodes[0] ?? "",
            radiusKm: Number(radiusKm),
            isPrimary,
          }),
        }
      );

      const body = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          body.error || "Enregistrement impossible."
        );
      }

      setSuccessMessage(
        body.message || "Zone enregistrée."
      );
      setLocality("");
      setRadiusKm("10");
      setIsPrimary(false);
      await load();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Enregistrement impossible."
      );
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
      const response = await fetch(
        "/api/provider/zones",
        {
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
        }
      );

      const body = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          body.error || "Modification impossible."
        );
      }

      setSuccessMessage(
        body.message || "Zone principale mise à jour."
      );
      await load();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Modification impossible."
      );
    } finally {
      setBusyId("");
    }
  }

  async function removeZone(zoneId: string) {
    if (!window.confirm("Supprimer cette zone ?")) return;

    setBusyId(zoneId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const accessToken = await token();
      const response = await fetch(
        "/api/provider/zones",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ zoneId }),
        }
      );

      const body = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          body.error || "Suppression impossible."
        );
      }

      setSuccessMessage(
        body.message || "Zone supprimée."
      );
      await load();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Suppression impossible."
      );
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
            Espace prestataire uniquement
          </div>

          <h1 className="mt-5 text-3xl font-black sm:text-5xl">
            Zones d’intervention
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
            Choisis les communes où tu acceptes de travailler pour
            chaque métier. KLYX n’enregistre pas ta position GPS
            personnelle.
          </p>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="mt-7 inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-zinc-950 disabled:opacity-50"
          >
            <RefreshCw size={17} />
            Actualiser
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
            Ajouter une zone
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
              Active d’abord un métier dans ton Studio
              prestataire.
            </div>
          ) : (
            <>
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <label>
                  <span className="mb-2 block text-sm font-black">
                    Métier
                  </span>
                  <select
                    value={userServiceId}
                    onChange={(event) =>
                      setUserServiceId(event.target.value)
                    }
                    className="klyx-input"
                  >
                    {services.map((service) => (
                      <option
                        key={service.id}
                        value={service.id}
                      >
                        {serviceLabel(service)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className="mb-2 block text-sm font-black">
                    Commune principale
                  </span>
                  <select
                    value={locality}
                    onChange={(event) =>
                      setLocality(event.target.value)
                    }
                    className="klyx-input"
                  >
                    <option value="">
                      Choisir une commune
                    </option>
                    {BELGIAN_LOCALITIES.map((item) => (
                      <option
                        key={item.name}
                        value={item.name}
                      >
                        {item.name} ·{" "}
                        {item.postalCodes.join(", ")} ·{" "}
                        {item.region}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className="mb-2 block text-sm font-black">
                    Rayon maximal
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
                      Zone principale
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Cette zone sera prioritaire pour ce métier.
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
                Ajouter la zone
              </button>
            </>
          )}
        </form>

        <section className="mt-8">
          <p className="klyx-eyebrow">
            Couverture professionnelle
          </p>
          <h2 className="mt-2 text-2xl font-black">
            Mes zones enregistrées
          </h2>

          {!loading && zones.length === 0 ? (
            <div className="klyx-card mt-5 p-8 text-center">
              <MapPin
                className="mx-auto text-cyan-600"
                size={40}
              />
              <p className="mt-4 font-black">
                Aucune zone enregistrée
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {zones.map((zone) => {
                const service = services.find(
                  (item) =>
                    item.id === zone.user_service_id
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
                              Principale
                            </span>
                          )}
                        </div>

                        <p className="mt-2 text-sm text-muted-foreground">
                          {zone.postal_code ?? "Belgique"} · rayon{" "}
                          {zone.radius_km} km
                        </p>
                        <p className="mt-1 text-sm font-black text-cyan-700 dark:text-cyan-300">
                          {service
                            ? serviceLabel(service)
                            : "Métier KLYX"}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={busyId === zone.id}
                        onClick={() =>
                          void removeZone(zone.id)
                        }
                        className="grid h-10 w-10 place-items-center rounded-xl border border-rose-500/25 text-rose-600 disabled:opacity-50"
                        aria-label="Supprimer la zone"
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
                        onClick={() =>
                          void setPrimary(zone)
                        }
                        className="mt-4 inline-flex items-center gap-2 text-xs font-black text-amber-700 dark:text-amber-300"
                      >
                        <Star size={15} />
                        Définir comme principale
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
