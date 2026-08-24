"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  MapPin,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  formatKlyxPublicProviderAvailability,
  formatKlyxPublicProviderCompletedJobs,
  formatKlyxPublicProviderExperience,
  formatKlyxPublicProviderPrice,
  formatKlyxPublicProviderScoreLabel,
  formatKlyxPublicProviderServiceLabel,
  translateKlyxPublicProvider,
  type KlyxPublicProviderMessageKey,
} from "@/lib/klyx-public-provider-i18n";
import type { PricingType } from "@/lib/provider-studio";
import { supabase } from "@/lib/supabase";
import PublicReviews from "./PublicReviews";

// KLYX_PUBLIC_PROVIDER_I18N
// KLYX_PUBLIC_PROVIDER_READ_ONLY

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  city: string | null;
  avatar_url: string | null;
};

type ProviderProfileRow = {
  business_name: string | null;
  headline: string | null;
  bio: string | null;
  years_experience: number | null;
  is_published: boolean;
  verification_status: string | null;
};

type UserServiceRow = {
  id: string;
  service_id: string;
};

type ServiceRow = {
  id: string;
  name: string;
  slug: string;
};

type ServiceProfileRow = {
  user_service_id: string;
  title: string | null;
  description: string | null;
  pricing_type: string | null;
  price: number | null;
  city: string | null;
  service_area: string[] | null;
  travel_radius_km: number | null;
  available: boolean | null;
  klyx_score: number | null;
  completed_jobs: number | null;
  cancellation_rate: number | null;
};

type AvailabilityRow = {
  user_service_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

type GalleryRow = {
  id: string;
  public_url: string;
  caption: string | null;
};

type ProviderService = {
  userServiceId: string;
  slug: string;
  serviceName: string;
  title: string | null;
  description: string;
  pricingType: PricingType;
  price: number | null;
  city: string;
  serviceArea: string[];
  travelRadiusKm: number;
  klyxScore: number;
  completedJobs: number;
  cancellationRate: number;
  availabilityCount: number;
};

export default function ProviderProfilePage() {
  const params = useParams<{ id: string }>();
  const providerId = params.id;
  const { locale } = useKlyxLocale();
  const t = (key: KlyxPublicProviderMessageKey) =>
    translateKlyxPublicProvider(locale, key);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [providerProfile, setProviderProfile] = useState<ProviderProfileRow | null>(null);
  const [services, setServices] = useState<ProviderService[]>([]);
  const [gallery, setGallery] = useState<GalleryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    async function loadProvider() {
      setLoading(true);
      setLoadError(false);

      try {
        const [
          profileResult,
          providerProfileResult,
          userServicesResult,
          galleryResult,
          verifiedServicesResponse,
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, first_name, last_name, city, avatar_url")
            .eq("id", providerId)
            .maybeSingle(),
          supabase
            .from("provider_profiles")
            .select(
              "business_name, headline, bio, years_experience, is_published, verification_status"
            )
            .eq("profile_id", providerId)
            .maybeSingle(),
          supabase
            .from("user_services")
            .select("id, service_id")
            .eq("user_id", providerId)
            .eq("active", true),
          supabase
            .from("provider_gallery")
            .select("id, public_url, caption")
            .eq("profile_id", providerId)
            .order("position", { ascending: true })
            .limit(8),
          fetch(`/api/providers/${providerId}/verified-services`, {
            cache: "no-store",
          }),
        ]);

        const firstError = [
          profileResult.error,
          providerProfileResult.error,
          userServicesResult.error,
          galleryResult.error,
        ].find(Boolean);

        if (firstError) throw new Error("KLYX_PUBLIC_PROVIDER_LOAD_FAILED");

        if (!profileResult.data || !providerProfileResult.data) {
          setProfile(null);
          return;
        }

        const profileData = profileResult.data as ProfileRow;
        const commercialData = providerProfileResult.data as ProviderProfileRow;

        if (!verifiedServicesResponse.ok) {
          throw new Error("KLYX_PUBLIC_PROVIDER_VERIFICATION_LOAD_FAILED");
        }

        const verifiedServicesBody = (await verifiedServicesResponse.json()) as {
          userServiceIds?: string[];
        };
        const approvedUserServiceIds = new Set(
          verifiedServicesBody.userServiceIds ?? []
        );
        const userServices = ((userServicesResult.data ?? []) as UserServiceRow[]).filter(
          (item) => approvedUserServiceIds.has(item.id)
        );

        if (!commercialData.is_published && userServices.length === 0) {
          setProfile(null);
          return;
        }

        let providerServices: ProviderService[] = [];

        if (userServices.length > 0) {
          const userServiceIds = userServices.map((item) => item.id);
          const serviceIds = userServices.map((item) => item.service_id);
          const [servicesResult, serviceProfilesResult, availabilityResult] =
            await Promise.all([
              supabase.from("services").select("id, name, slug").in("id", serviceIds),
              supabase
                .from("service_profiles")
                .select(
                  "user_service_id, title, description, pricing_type, price, city, service_area, travel_radius_km, available, klyx_score, completed_jobs, cancellation_rate"
                )
                .in("user_service_id", userServiceIds)
                .eq("available", true),
              supabase
                .from("availability_slots")
                .select("user_service_id, day_of_week, start_time, end_time, is_active")
                .in("user_service_id", userServiceIds)
                .eq("is_active", true),
            ]);

          const nestedError = [
            servicesResult.error,
            serviceProfilesResult.error,
            availabilityResult.error,
          ].find(Boolean);

          if (nestedError) throw new Error("KLYX_PUBLIC_PROVIDER_SERVICE_LOAD_FAILED");

          const serviceRows = (servicesResult.data ?? []) as ServiceRow[];
          const serviceProfiles = (serviceProfilesResult.data ?? []) as ServiceProfileRow[];
          const availability = (availabilityResult.data ?? []) as AvailabilityRow[];
          const serviceById = new Map(
            serviceRows.map((service) => [service.id, service])
          );
          const profileByUserService = new Map(
            serviceProfiles.map((item) => [item.user_service_id, item])
          );

          providerServices = userServices
            .map((userService): ProviderService | null => {
              const service = serviceById.get(userService.service_id);
              const serviceProfile = profileByUserService.get(userService.id);

              if (!service || !serviceProfile || !serviceProfile.available) {
                return null;
              }

              return {
                userServiceId: userService.id,
                slug: service.slug,
                serviceName: service.name,
                title: serviceProfile.title,
                description: serviceProfile.description ?? "",
                pricingType:
                  serviceProfile.pricing_type === "fixed" ? "fixed" : "hourly",
                price:
                  serviceProfile.price === null ? null : Number(serviceProfile.price),
                city: serviceProfile.city ?? profileData.city ?? "",
                serviceArea: serviceProfile.service_area ?? [],
                travelRadiusKm: Number(serviceProfile.travel_radius_km ?? 10),
                klyxScore: Number(serviceProfile.klyx_score ?? 50),
                completedJobs: Number(serviceProfile.completed_jobs ?? 0),
                cancellationRate: Number(serviceProfile.cancellation_rate ?? 0),
                availabilityCount: availability.filter(
                  (item) => item.user_service_id === userService.id
                ).length,
              };
            })
            .filter((item): item is ProviderService => item !== null)
            .sort((a, b) => b.klyxScore - a.klyxScore);
        }

        setProfile(profileData);
        setProviderProfile(commercialData);
        setServices(providerServices);
        setGallery((galleryResult.data ?? []) as GalleryRow[]);
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    }

    void loadProvider();
  }, [providerId]);

  const bestScore = useMemo(
    () =>
      services.length === 0
        ? 50
        : Math.max(...services.map((service) => service.klyxScore)),
    [services]
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground dark:bg-zinc-950 dark:text-white">
        {t("loading")}
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="min-h-screen bg-background px-5 py-10 text-foreground dark:bg-zinc-950 dark:text-white">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-700 dark:text-red-300">
          {t("loadError")}
        </div>
      </main>
    );
  }

  if (!profile || !providerProfile) {
    return (
      <main className="min-h-screen bg-background px-5 py-10 text-foreground dark:bg-zinc-950 dark:text-white">
        <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="text-2xl font-bold">{t("notFoundTitle")}</h1>
          <p className="mt-3 text-muted-foreground dark:text-zinc-400">
            {t("notFoundText")}
          </p>
          <Link
            href="/search"
            className="mt-6 inline-flex rounded-xl bg-violet-600 px-6 py-3 font-semibold hover:bg-violet-700"
          >
            {t("backToSearch")}
          </Link>
        </div>
      </main>
    );
  }

  const fullName =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    t("providerEyebrow");

  return (
    <main className="min-h-screen bg-background px-5 py-10 text-foreground dark:bg-zinc-950 dark:text-white">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/search"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground dark:text-zinc-400 dark:hover:text-white"
        >
          <ArrowLeft size={17} />
          {t("backToSearch")}
        </Link>

        <section className="mt-8 overflow-hidden rounded-3xl border border-border bg-card/70 dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="grid md:grid-cols-[340px_1fr]">
            <div className="flex min-h-96 items-center justify-center bg-muted dark:bg-zinc-800">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt={fullName}
                  className="h-full min-h-96 w-full object-cover"
                />
              ) : (
                <UserRound
                  size={90}
                  className="text-muted-foreground dark:text-zinc-500"
                />
              )}
            </div>

            <div className="p-6 sm:p-10">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="max-w-2xl">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-400">
                      {t("providerEyebrow")}
                    </p>
                    {providerProfile.verification_status === "verified" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                        <BadgeCheck size={15} /> {t("identityVerified")}
                      </span>
                    )}
                  </div>

                  <h1 className="mt-3 text-3xl font-bold sm:text-5xl">{fullName}</h1>

                  {providerProfile.business_name && (
                    <p className="mt-2 text-lg text-muted-foreground dark:text-zinc-400">
                      {providerProfile.business_name}
                    </p>
                  )}

                  <p className="mt-5 text-xl font-semibold text-foreground dark:text-white">
                    {providerProfile.headline || t("headlineFallback")}
                  </p>

                  {providerProfile.bio && (
                    <p className="mt-4 whitespace-pre-line leading-7 text-foreground/80 dark:text-zinc-300">
                      {providerProfile.bio}
                    </p>
                  )}

                  <div className="mt-6 flex flex-wrap gap-4 text-sm text-muted-foreground dark:text-zinc-400">
                    <span className="inline-flex items-center gap-2">
                      <MapPin size={17} /> {profile.city || "Bruxelles"}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <BriefcaseBusiness size={17} />
                      {formatKlyxPublicProviderExperience(
                        locale,
                        Number(providerProfile.years_experience ?? 0)
                      )}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 px-5 py-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-violet-700 dark:text-violet-300">
                    <ShieldCheck size={20} />
                    <span className="text-sm font-semibold">{t("score")}</span>
                  </div>
                  <p className="mt-2 text-4xl font-bold text-violet-700 dark:text-violet-300">
                    {bestScore.toFixed(0)}
                  </p>
                  <p className="text-sm text-muted-foreground dark:text-zinc-400">/100</p>
                  <p className="mt-2 text-sm font-semibold text-violet-700 dark:text-violet-200">
                    {formatKlyxPublicProviderScoreLabel(locale, bestScore)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {gallery.length > 0 && (
          <section className="mt-8">
            <h2 className="text-2xl font-bold">{t("galleryTitle")}</h2>
            <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
              {gallery.map((item) => (
                <figure
                  key={item.id}
                  className="aspect-square overflow-hidden rounded-2xl border border-border bg-card dark:border-zinc-800 dark:bg-zinc-900"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.public_url}
                    alt={item.caption || t("galleryAlt")}
                    className="h-full w-full object-cover"
                  />
                </figure>
              ))}
            </div>
          </section>
        )}

        <section className="mt-8">
          <h2 className="text-2xl font-bold">{t("servicesTitle")}</h2>
          {services.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-border bg-card p-6 text-muted-foreground dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              {t("noServices")}
            </div>
          ) : (
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              {services.map((service) => {
                const serviceLabel = formatKlyxPublicProviderServiceLabel(
                  locale,
                  service.slug,
                  service.serviceName
                );

                return (
                  <article
                    key={service.userServiceId}
                    className="rounded-2xl border border-border bg-card p-6 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-400">
                          {serviceLabel}
                        </p>
                        <h3 className="mt-2 text-xl font-bold">
                          {service.title ?? serviceLabel}
                        </h3>
                      </div>
                      <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-center">
                        <p className="text-2xl font-bold text-violet-700 dark:text-violet-300">
                          {service.klyxScore.toFixed(0)}
                        </p>
                        <p className="text-xs text-muted-foreground dark:text-zinc-400">/100</p>
                      </div>
                    </div>

                    {service.description && (
                      <p className="mt-4 line-clamp-4 leading-6 text-foreground/80 dark:text-zinc-300">
                        {service.description}
                      </p>
                    )}

                    <div className="mt-5 space-y-2 text-sm text-muted-foreground dark:text-zinc-400">
                      <p className="flex items-center gap-2">
                        <MapPin size={16} />
                        {service.serviceArea.length > 0
                          ? service.serviceArea.join(", ")
                          : service.city || t("cityMissing")}
                        {service.travelRadiusKm > 0
                          ? ` · ${service.travelRadiusKm} km`
                          : ""}
                      </p>
                      <p className="flex items-center gap-2">
                        <Clock3 size={16} />
                        {formatKlyxPublicProviderAvailability(
                          locale,
                          service.availabilityCount
                        )}
                      </p>
                      <p className="flex items-center gap-2">
                        <CheckCircle2 size={16} />
                        {formatKlyxPublicProviderCompletedJobs(
                          locale,
                          service.completedJobs
                        )}
                      </p>
                      <p>
                        {t("cancellationRate")}: {service.cancellationRate.toFixed(1)} %
                      </p>
                    </div>

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                      <p className="text-xl font-bold text-violet-600 dark:text-violet-400">
                        {formatKlyxPublicProviderPrice(
                          locale,
                          service.price,
                          service.pricingType
                        )}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/providers/${profile.id}/quote?service=${encodeURIComponent(
                            service.slug
                          )}`}
                          className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-5 py-3 font-semibold text-violet-700 transition hover:bg-violet-500/15 dark:text-violet-200"
                        >
                          {t("quote")}
                        </Link>

                        <Link
                          href={`/providers/${profile.id}/book?service=${encodeURIComponent(
                            service.slug
                          )}`}
                          className="rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white transition hover:bg-violet-700"
                        >
                          {t("book")}
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <PublicReviews
          providerId={profile.id}
          klyxScore={bestScore}
          verified={providerProfile.verification_status === "verified"}
          yearsExperience={Number(providerProfile.years_experience ?? 0)}
        />
      </div>
    </main>
  );
}
