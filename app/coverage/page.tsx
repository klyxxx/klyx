"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  Navigation,
  Route,
  Star,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { BELGIAN_LOCALITIES } from "@/lib/belgian-localities";
import KlyxSelect from "@/app/components/KlyxSelect";

type Service = {
  id: string;
  name: string | null;
  slug: string;
};

type ProviderCoverage = {
  profileId: string;
  displayName: string;
  avatarUrl: string | null;
  serviceName: string;
  serviceSlug: string;
  requestedLocality: string;
  zoneLocality: string;
  zonePostalCode: string | null;
  radiusKm: number;
  distanceKm: number;
  remainingKm: number;
  isPrimary: boolean;
  coverageMessage: string;
};

type CoverageResponse = {
  services?: Service[];
  providers?: ProviderCoverage[];
  searched?: boolean;
  privacyNotice?: string;
  error?: string;
};

export default function CoveragePage() {
  const [services, setServices] = useState<Service[]>([]);
  const [serviceSlug, setServiceSlug] = useState("");
  const [locality, setLocality] = useState("");
  const [providers, setProviders] = useState<
    ProviderCoverage[]
  >([]);
  const [searched, setSearched] = useState(false);
  const [privacyNotice, setPrivacyNotice] =
    useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [errorMessage, setErrorMessage] =
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

  async function loadServices() {
    setLoading(true);
    setErrorMessage("");

    try {
      const accessToken = await token();
      const response = await fetch(
        "/api/search/coverage",
        {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const body =
        (await response.json()) as CoverageResponse;

      if (!response.ok) {
        throw new Error(
          body.error || "Chargement impossible."
        );
      }

      const nextServices = body.services ?? [];
      setServices(nextServices);

      if (!serviceSlug && nextServices[0]?.slug) {
        setServiceSlug(nextServices[0].slug);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de charger les services."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadServices();
  }, []);

  async function searchCoverage(event: FormEvent) {
    event.preventDefault();

    if (!serviceSlug || !locality || searching) {
      return;
    }

    setSearching(true);
    setErrorMessage("");
    setProviders([]);
    setSearched(false);

    try {
      const accessToken = await token();
      const params = new URLSearchParams({
        service: serviceSlug,
        locality,
      });

      const response = await fetch(
        `/api/search/coverage?${params.toString()}`,
        {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const body =
        (await response.json()) as CoverageResponse;

      if (!response.ok) {
        throw new Error(
          body.error || "Recherche impossible."
        );
      }

      setProviders(body.providers ?? []);
      setSearched(Boolean(body.searched));
      setPrivacyNotice(body.privacyNotice ?? "");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Recherche impossible."
      );
    } finally {
      setSearching(false);
    }
  }

  function searchHref(
    provider: ProviderCoverage
  ): string {
    const params = new URLSearchParams({
      service: provider.serviceSlug,
      city: locality,
    });

    return `/search?${params.toString()}`;
  }

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-6xl">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#17131f,#164e63_52%,#101827)] p-7 text-white sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/70">
            <Navigation size={15} />
            Distance entre communes
          </div>

          <h1 className="mt-5 text-3xl font-black sm:text-5xl">
            Trouve les prestataires réellement dans leur rayon
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
            KLYX compare ta commune avec les zones professionnelles
            déclarées et vérifie automatiquement le rayon maximal.
          </p>
        </section>

        <form
          onSubmit={searchCoverage}
          className="klyx-card mt-8 p-6 sm:p-8"
        >
          <div className="grid gap-5 md:grid-cols-2">
            <label>
              <span className="mb-2 block text-sm font-black">
                Service recherché
              </span>
              <KlyxSelect
                value={serviceSlug}
                onChange={setServiceSlug}
                disabled={loading}
                options={services.map((service) => ({
                  value: service.slug,
                  label: service.name ?? service.slug,
                }))}
                ariaLabel="Service recherché"
              />
            </label>

            <label>
              <span className="mb-2 block text-sm font-black">
                Ma commune
              </span>
              <KlyxSelect
                value={locality}
                onChange={setLocality}
                placeholder="Choisir une commune"
                options={BELGIAN_LOCALITIES.map((item) => ({
                  value: item.name,
                  label: `${item.name} · ${item.postalCodes.join(", ")}`,
                }))}
                ariaLabel="Ma commune"
              />
            </label>
          </div>

          {errorMessage && (
            <div className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-rose-700 dark:text-rose-300">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={
              searching ||
              loading ||
              !serviceSlug ||
              !locality
            }
            className="klyx-button mt-6 w-full"
          >
            {searching ? (
              <LoaderCircle
                className="animate-spin"
                size={19}
              />
            ) : (
              <Route size={19} />
            )}
            Calculer la couverture
          </button>
        </form>

        {searched && (
          <section className="mt-8">
            <p className="klyx-eyebrow">
              Couverture calculée
            </p>
            <h2 className="mt-2 text-2xl font-black">
              {providers.length} prestataire
              {providers.length > 1 ? "s" : ""} dans le rayon
            </h2>

            {providers.length === 0 ? (
              <div className="klyx-card mt-5 p-8 text-center">
                <MapPin
                  className="mx-auto text-amber-500"
                  size={42}
                />
                <h3 className="mt-4 text-xl font-black">
                  Aucun rayon compatible
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Les zones déclarées pour ce service ne couvrent
                  pas cette commune actuellement.
                </p>

                <Link
                  href={`/search?service=${encodeURIComponent(
                    serviceSlug
                  )}&city=${encodeURIComponent(locality)}`}
                  className="klyx-button mt-5"
                >
                  Ouvrir la recherche générale
                  <ArrowRight size={18} />
                </Link>
              </div>
            ) : (
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                {providers.map((provider) => (
                  <article
                    key={`${provider.profileId}-${provider.serviceSlug}`}
                    className="klyx-card p-6"
                  >
                    <div className="flex items-start gap-4">
                      <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-cyan-500/10 text-cyan-600">
                        {provider.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={provider.avatarUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Users size={24} />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-black">
                            {provider.displayName}
                          </h3>

                          {provider.isPrimary && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-black uppercase text-amber-700 dark:text-amber-300">
                              <Star size={12} />
                              Zone principale
                            </span>
                          )}
                        </div>

                        <p className="mt-2 text-sm font-black text-cyan-700 dark:text-cyan-300">
                          {provider.serviceName}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-3">
                      <Metric
                        label="Distance"
                        value={`${provider.distanceKm} km`}
                      />
                      <Metric
                        label="Rayon"
                        value={`${provider.radiusKm} km`}
                      />
                      <Metric
                        label="Marge"
                        value={`${provider.remainingKm} km`}
                      />
                    </div>

                    <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-muted-foreground">
                      <CheckCircle2
                        className="mt-0.5 shrink-0 text-emerald-500"
                        size={17}
                      />
                      {provider.coverageMessage}
                    </p>

                    <Link
                      href={searchHref(provider)}
                      className="klyx-button mt-5 w-full"
                    >
                      Voir dans la recherche
                      <ArrowRight size={18} />
                    </Link>
                  </article>
                ))}
              </div>
            )}

            {privacyNotice && (
              <div className="mt-6 flex gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5">
                <LockKeyhole
                  className="mt-0.5 shrink-0 text-emerald-600"
                  size={20}
                />
                <p className="text-sm leading-6 text-muted-foreground">
                  {privacyNotice}
                </p>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-3 text-center">
      <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-black">
        {value}
      </p>
    </div>
  );
}

