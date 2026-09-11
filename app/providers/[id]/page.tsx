"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  Clock3,
  MapPin,
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
// KLYX_PUBLIC_PROVIDER_VISUAL_SIMPLIFICATION
// KLYX_PROVIDER_PROPOSAL_ASSISTANT_FIRST_20260911

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
            .limit(3),
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
  const completedJobs = useMemo(
    () =>
      services.length === 0
        ? 0
        : Math.max(...services.map((service) => service.completedJobs)),
    [services]
  );

  if (loading) {
    return (
      <main className="klyx-page grid min-h-screen place-items-center">
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="klyx-page">
        <div className="mx-auto max-w-3xl border-y border-red-500/30 py-6 text-sm text-red-700 dark:text-red-300">
          {t("loadError")}
        </div>
      </main>
    );
  }

  if (!profile || !providerProfile) {
    return (
      <main className="klyx-page">
        <div className="mx-auto max-w-3xl py-12 text-center">
          <h1 className="text-2xl font-semibold">{t("notFoundTitle")}</h1>
          <p className="mt-3 text-muted-foreground">{t("notFoundText")}</p>
          <Link
            href="/search"
            className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
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
  const primaryService = services[0] ?? null;
  const otherServices = services.slice(1);

  const serviceView = (service: ProviderService, primary = false) => {
    const serviceName = formatKlyxPublicProviderServiceLabel(
      locale,
      service.slug,
      service.serviceName
    );

    return (
      <article
        key={service.userServiceId}
        data-testid={primary ? "klyx-primary-provider-service" : undefined}
        className="py-6 first:pt-0 last:pb-0"
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 max-w-2xl">
            <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
              {serviceName}
            </p>
            <h3 className="mt-1 text-xl font-semibold">
              {service.title ?? serviceName}
            </h3>
            {service.description && (
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
                {service.description}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={15} />
                {service.serviceArea.length > 0
                  ? service.serviceArea.join(", ")
                  : service.city || t("cityMissing")}
                {service.travelRadiusKm > 0 ? ` · ${service.travelRadiusKm} km` : ""}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock3 size={15} />
                {formatKlyxPublicProviderAvailability(
                  locale,
                  service.availabilityCount
                )}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 size={15} />
                {formatKlyxPublicProviderCompletedJobs(
                  locale,
                  service.completedJobs
                )}
              </span>
              <span>
                {t("cancellationRate")}: {service.cancellationRate.toFixed(1)} %
              </span>
            </div>
          </div>

          <div className="shrink-0 sm:text-right">
            <p className="text-lg font-semibold">
              {formatKlyxPublicProviderPrice(
                locale,
                service.price,
                service.pricingType
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 sm:justify-end">
              <Link
                href={`/providers/${profile.id}/quote?service=${encodeURIComponent(
                  service.slug
                )}`}
                className="inline-flex min-h-10 items-center rounded-xl border border-border px-4 py-2 text-sm font-semibold transition hover:border-blue-600/50 hover:text-blue-600"
              >
                {t("quote")}
              </Link>
              <Link
                href={`/providers/${profile.id}/book?service=${encodeURIComponent(
                  service.slug
                )}`}
                className="inline-flex min-h-10 items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                {t("book")}
              </Link>
            </div>
          </div>
        </div>
      </article>
    );
  };

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/search"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft size={17} />
          {t("backToSearch")}
        </Link>

        <section className="mt-8" data-testid="klyx-provider-proposal">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-muted">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt={fullName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserRound size={34} className="text-muted-foreground" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                  {t("providerEyebrow")}
                </p>
                {providerProfile.verification_status === "verified" && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    <BadgeCheck size={14} /> {t("identityVerified")}
                  </span>
                )}
              </div>

              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                {fullName}
              </h1>
              {providerProfile.business_name && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {providerProfile.business_name}
                </p>
              )}
              <p className="mt-3 text-lg font-medium">
                {providerProfile.headline || t("headlineFallback")}
              </p>

              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={16} /> {profile.city || "Bruxelles"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <BriefcaseBusiness size={16} />
                  {formatKlyxPublicProviderExperience(
                    locale,
                    Number(providerProfile.years_experience ?? 0)
                  )}
                </span>
              </div>
            </div>
          </div>

          <section
            data-testid="klyx-provider-assistant-summary"
            className="mt-7 border-y border-border py-5"
          >
            <p className="text-sm font-semibold">{t("assistantChoice")}</p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {formatKlyxPublicProviderScoreLabel(locale, bestScore)}
              </span>
              {providerProfile.verification_status === "verified" && (
                <span>{t("identityVerified")}</span>
              )}
              <span>
                {formatKlyxPublicProviderCompletedJobs(locale, completedJobs)}
              </span>
              <span>
                {formatKlyxPublicProviderExperience(
                  locale,
                  Number(providerProfile.years_experience ?? 0)
                )}
              </span>
            </div>
          </section>

          {providerProfile.bio && (
            <p className="mt-6 max-w-3xl whitespace-pre-line text-sm leading-7 text-foreground/80">
              {providerProfile.bio}
            </p>
          )}
        </section>

        <section className="mt-10" aria-labelledby="provider-services-title">
          <h2 id="provider-services-title" className="text-2xl font-semibold">
            {t("servicesTitle")}
          </h2>

          {primaryService ? (
            <div className="mt-5 border-y border-border py-6">
              {serviceView(primaryService, true)}
            </div>
          ) : (
            <p className="mt-5 border-y border-border py-6 text-sm text-muted-foreground">
              {t("noServices")}
            </p>
          )}

          {otherServices.length > 0 && (
            <details
              data-testid="klyx-other-provider-services"
              className="group border-b border-border"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-semibold marker:content-none">
                {t("otherServices")}
                <ChevronDown
                  size={17}
                  className="transition group-open:rotate-180"
                />
              </summary>
              <div className="divide-y divide-border border-t border-border">
                {otherServices.map((service) => serviceView(service))}
              </div>
            </details>
          )}
        </section>

        {gallery.length > 0 && (
          <details className="group mt-8 border-y border-border">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-semibold marker:content-none">
              {t("galleryTitle")}
              <ChevronDown
                size={17}
                className="transition group-open:rotate-180"
              />
            </summary>
            <div className="grid gap-3 border-t border-border py-5 sm:grid-cols-3">
              {gallery.map((item) => (
                <figure
                  key={item.id}
                  className="aspect-[4/3] overflow-hidden rounded-xl bg-muted"
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
          </details>
        )}

        <details
          data-testid="klyx-provider-trust-details"
          className="group mt-8 border-y border-border"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-semibold marker:content-none">
            {t("trustDetails")}
            <ChevronDown
              size={17}
              className="transition group-open:rotate-180"
            />
          </summary>
          <div className="border-t border-border pb-8">
            <PublicReviews
              providerId={profile.id}
              klyxScore={bestScore}
              verified={providerProfile.verification_status === "verified"}
              yearsExperience={Number(providerProfile.years_experience ?? 0)}
            />
          </div>
        </details>
      </div>
    </main>
  );
}
