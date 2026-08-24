"use client";

import { FormEvent, useEffect, useState } from "react";
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

import KlyxSelect from "@/app/components/KlyxSelect";
import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import { BELGIAN_LOCALITIES } from "@/lib/belgian-localities";
import {
  formatKlyxCoverageProviderCount,
  translateKlyxCoverage,
  type KlyxCoverageMessageKey,
} from "@/lib/klyx-coverage-i18n";
import { supabase } from "@/lib/supabase";

// KLYX_COVERAGE_I18N
// KLYX_COVERAGE_READ_ONLY

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
  const { locale } = useKlyxLocale();
  const t = (key: KlyxCoverageMessageKey) => translateKlyxCoverage(locale, key);

  const [services, setServices] = useState<Service[]>([]);
  const [serviceSlug, setServiceSlug] = useState("");
  const [locality, setLocality] = useState("");
  const [providers, setProviders] = useState<ProviderCoverage[]>([]);
  const [searched, setSearched] = useState(false);
  const [privacyNotice, setPrivacyNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [errorKey, setErrorKey] = useState<KlyxCoverageMessageKey | null>(null);

  async function token(): Promise<string> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("KLYX_COVERAGE_SESSION_MISSING");
    }

    return session.access_token;
  }

  async function loadServices() {
    setLoading(true);
    setErrorKey(null);

    try {
      const accessToken = await token();
      const response = await fetch("/api/search/coverage", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const body = (await response.json()) as CoverageResponse;

      if (!response.ok) {
        setErrorKey("loadError");
        return;
      }

      const nextServices = body.services ?? [];
      setServices(nextServices);

      if (!serviceSlug && nextServices[0]?.slug) {
        setServiceSlug(nextServices[0].slug);
      }
    } catch {
      setErrorKey("loadError");
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
    setErrorKey(null);
    setProviders([]);
    setSearched(false);

    try {
      const accessToken = await token();
      const params = new URLSearchParams({
        service: serviceSlug,
        locality,
      });

      const response = await fetch(`/api/search/coverage?${params.toString()}`, {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const body = (await response.json()) as CoverageResponse;

      if (!response.ok) {
        setErrorKey("searchError");
        return;
      }

      setProviders(body.providers ?? []);
      setSearched(Boolean(body.searched));
      setPrivacyNotice(body.privacyNotice ?? "");
    } catch {
      setErrorKey("searchError");
    } finally {
      setSearching(false);
    }
  }

  function searchHref(provider: ProviderCoverage): string {
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
            {t("eyebrow")}
          </div>

          <h1 className="mt-5 text-3xl font-black sm:text-5xl">{t("title")}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">{t("description")}</p>
        </section>

        <form onSubmit={searchCoverage} className="klyx-card mt-8 p-6 sm:p-8">
          <div className="grid gap-5 md:grid-cols-2">
            <label>
              <span className="mb-2 block text-sm font-black">{t("serviceLabel")}</span>
              <KlyxSelect
                value={serviceSlug}
                onChange={setServiceSlug}
                disabled={loading}
                options={services.map((service) => ({
                  value: service.slug,
                  label: service.name ?? service.slug,
                }))}
                ariaLabel={t("serviceLabel")}
              />
            </label>

            <label>
              <span className="mb-2 block text-sm font-black">{t("localityLabel")}</span>
              <KlyxSelect
                value={locality}
                onChange={setLocality}
                placeholder={t("localityPlaceholder")}
                options={BELGIAN_LOCALITIES.map((item) => ({
                  value: item.name,
                  label: `${item.name} · ${item.postalCodes.join(", ")}`,
                }))}
                ariaLabel={t("localityLabel")}
              />
            </label>
          </div>

          {errorKey && (
            <div className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-rose-700 dark:text-rose-300">
              {t(errorKey)}
            </div>
          )}

          <button
            type="submit"
            disabled={searching || loading || !serviceSlug || !locality}
            className="klyx-button mt-6 w-full"
          >
            {searching ? (
              <LoaderCircle className="animate-spin" size={19} />
            ) : (
              <Route size={19} />
            )}
            {searching ? t("calculating") : t("calculate")}
          </button>
        </form>

        {searched && (
          <section className="mt-8">
            <p className="klyx-eyebrow">{t("resultsEyebrow")}</p>
            <h2 className="mt-2 text-2xl font-black">
              {formatKlyxCoverageProviderCount(locale, providers.length)}
            </h2>

            {providers.length === 0 ? (
              <div className="klyx-card mt-5 p-8 text-center">
                <MapPin className="mx-auto text-amber-500" size={42} />
                <h3 className="mt-4 text-xl font-black">{t("noCoverageTitle")}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t("noCoverageDescription")}</p>

                <Link
                  href={`/search?service=${encodeURIComponent(serviceSlug)}&city=${encodeURIComponent(locality)}`}
                  className="klyx-button mt-5"
                >
                  {t("openGeneralSearch")}
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
                          <img src={provider.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Users size={24} />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-black">{provider.displayName}</h3>
                          {provider.isPrimary && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-black uppercase text-amber-700 dark:text-amber-300">
                              <Star size={12} />
                              {t("primaryZone")}
                            </span>
                          )}
                        </div>

                        <p className="mt-2 text-sm font-black text-cyan-700 dark:text-cyan-300">
                          {provider.serviceName}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-3">
                      <Metric label={t("distance")} value={`${provider.distanceKm} km`} />
                      <Metric label={t("radius")} value={`${provider.radiusKm} km`} />
                      <Metric label={t("margin")} value={`${provider.remainingKm} km`} />
                    </div>

                    <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-500" size={17} />
                      {provider.coverageMessage}
                    </p>

                    <Link href={searchHref(provider)} className="klyx-button mt-5 w-full">
                      {t("viewInSearch")}
                      <ArrowRight size={18} />
                    </Link>
                  </article>
                ))}
              </div>
            )}

            {privacyNotice && (
              <div className="mt-6 flex gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5">
                <LockKeyhole className="mt-0.5 shrink-0 text-emerald-600" size={20} />
                <p className="text-sm leading-6 text-muted-foreground">{privacyNotice}</p>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-3 text-center">
      <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  );
}
