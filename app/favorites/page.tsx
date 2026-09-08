"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Heart, MapPin, Search, Star } from "lucide-react";

import FavoriteButton from "@/app/components/FavoriteButton";
import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import { getActiveClientProfile } from "@/lib/account-switcher";
import {
  formatKlyxFavoritePrice,
  translateKlyxFavorites,
  type KlyxFavoritesMessageKey,
} from "@/lib/klyx-favorites-i18n";
import { supabase } from "@/lib/supabase";

// KLYX_FAVORITES_PAGE_I18N
// KLYX_FAVORITES_VISUAL_SIMPLIFICATION

type FavoriteRow = { id: string; service_profile_id: string };
type ServiceProfileRow = {
  id: string;
  user_service_id: string;
  title: string | null;
  pricing_type: string | null;
  price: number | null;
  hourly_price: number | null;
  fixed_price: number | null;
  city: string | null;
  rating: number | null;
  review_count: number | null;
};
type UserServiceRow = { id: string; user_id: string };
type ProfileRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};
type FavoriteProvider = {
  userId: string;
  serviceProfileId: string;
  fullName: string;
  avatarUrl: string | null;
  title: string;
  city: string;
  pricingType: "hourly" | "fixed";
  price: number | null;
  rating: number;
  reviewCount: number;
};

export default function FavoritesPage() {
  const router = useRouter();
  const { locale } = useKlyxLocale();
  const t = useCallback(
    (key: KlyxFavoritesMessageKey) => translateKlyxFavorites(locale, key),
    [locale]
  );

  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<FavoriteProvider[]>([]);
  const [loadError, setLoadError] = useState(false);

  const loadFavorites = useCallback(async () => {
    setLoading(true);
    setLoadError(false);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const activeProfile = await getActiveClientProfile();
      const { data: favoriteRows, error: favoriteError } = await supabase
        .from("favorites")
        .select("id, service_profile_id")
        .eq("user_id", activeProfile.id);

      if (favoriteError) {
        throw new Error("KLYX_FAVORITES_LOAD_FAILED");
      }

      const favoriteList = (favoriteRows ?? []) as FavoriteRow[];
      if (favoriteList.length === 0) {
        setFavorites([]);
        return;
      }

      const serviceProfileIds = favoriteList.map(
        (favorite) => favorite.service_profile_id
      );
      const { data: serviceProfiles, error: serviceProfilesError } = await supabase
        .from("service_profiles")
        .select(
          "id, user_service_id, title, pricing_type, price, hourly_price, fixed_price, city, rating, review_count"
        )
        .in("id", serviceProfileIds);

      if (serviceProfilesError) {
        throw new Error("KLYX_FAVORITES_LOAD_FAILED");
      }

      const typedServiceProfiles = (serviceProfiles ?? []) as ServiceProfileRow[];
      const userServiceIds = typedServiceProfiles.map((item) => item.user_service_id);
      const { data: userServices, error: userServicesError } = await supabase
        .from("user_services")
        .select("id, user_id")
        .in("id", userServiceIds);

      if (userServicesError) {
        throw new Error("KLYX_FAVORITES_LOAD_FAILED");
      }

      const typedUserServices = (userServices ?? []) as UserServiceRow[];
      const userIds = typedUserServices.map((item) => item.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, first_name, last_name, avatar_url")
        .in("id", userIds);

      if (profilesError) {
        throw new Error("KLYX_FAVORITES_LOAD_FAILED");
      }

      const userServiceMap = new Map(
        typedUserServices.map((item) => [item.id, item])
      );
      const profileMap = new Map(
        ((profiles ?? []) as ProfileRow[]).map((item) => [item.id, item])
      );

      setFavorites(
        typedServiceProfiles
          .map((serviceProfile) => {
            const userService = userServiceMap.get(serviceProfile.user_service_id);
            if (!userService) return null;

            const profile = profileMap.get(userService.user_id);
            if (!profile) return null;

            const pricingType: "hourly" | "fixed" =
              serviceProfile.pricing_type === "fixed" ? "fixed" : "hourly";
            const dedicatedPrice =
              pricingType === "fixed"
                ? serviceProfile.fixed_price
                : serviceProfile.hourly_price;
            const price = dedicatedPrice ?? serviceProfile.price;

            return {
              userId: profile.id,
              serviceProfileId: serviceProfile.id,
              fullName:
                profile.full_name?.trim() ||
                `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim(),
              avatarUrl: profile.avatar_url,
              title: serviceProfile.title?.trim() ?? "",
              city: serviceProfile.city?.trim() ?? "",
              pricingType,
              price: price == null ? null : Number(price),
              rating: Number(serviceProfile.rating ?? 0),
              reviewCount: Number(serviceProfile.review_count ?? 0),
            } satisfies FavoriteProvider;
          })
          .filter((item): item is FavoriteProvider => item !== null)
      );
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadFavorites();
  }, [loadFavorites]);

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background text-foreground dark:bg-zinc-950 dark:text-white">
        <p className="text-sm text-muted-foreground dark:text-zinc-400">
          {t("loading")}
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-background px-3 py-5 text-foreground dark:bg-zinc-950 dark:text-white sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto min-w-0 max-w-5xl">
        <Link
          href="/search"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground dark:text-zinc-400 dark:hover:text-white"
        >
          <ArrowLeft size={17} />
          {t("backToSearch")}
        </Link>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground dark:text-zinc-500">
              KLYX
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
              {t("title")}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground dark:text-zinc-400">
              {t("description")}
            </p>
          </div>

          <Link
            href="/search"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#2563EB] px-5 text-sm font-bold text-white transition hover:bg-[#2563EB]/90"
          >
            <Search size={17} />
            {t("findService")}
          </Link>
        </div>

        {loadError && (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
            {t("loadError")}
          </div>
        )}

        {favorites.length === 0 ? (
          <section className="mt-8 rounded-3xl border border-border bg-card/60 p-7 text-center dark:border-zinc-800 dark:bg-zinc-900/60 sm:p-10">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground dark:bg-zinc-800 dark:text-zinc-400">
              <Heart size={22} />
            </span>
            <h2 className="mt-5 text-xl font-black">{t("emptyTitle")}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground dark:text-zinc-400">
              {t("emptyText")}
            </p>
            <Link
              href="/search"
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#2563EB] px-6 text-sm font-bold text-white transition hover:bg-[#2563EB]/90"
            >
              <Search size={17} />
              {t("findService")}
            </Link>
          </section>
        ) : (
          <section className="mt-8 overflow-hidden rounded-3xl border border-border bg-card/70 dark:border-zinc-800 dark:bg-zinc-900/70">
            <div className="divide-y divide-border dark:divide-zinc-800">
              {favorites.map((favorite) => {
                const displayName = favorite.fullName || t("providerFallback");
                const displayTitle = favorite.title || t("serviceFallback");
                const displayCity = favorite.city || t("cityFallback");

                return (
                  <article
                    key={favorite.serviceProfileId}
                    className="flex min-w-0 flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:px-5"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-4">
                      <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-muted dark:border-zinc-700 dark:bg-zinc-800">
                        {favorite.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={favorite.avatarUrl}
                            alt={displayName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Heart
                            size={22}
                            className="text-muted-foreground dark:text-zinc-500"
                          />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-base font-bold sm:text-lg">
                          {displayName}
                        </h2>
                        <p className="mt-0.5 truncate text-sm font-semibold text-foreground/80 dark:text-zinc-200">
                          {displayTitle}
                        </p>
                        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground dark:text-zinc-400">
                          <span className="inline-flex min-w-0 items-center gap-1.5">
                            <MapPin size={14} className="shrink-0" />
                            <span className="truncate">{displayCity}</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Star size={14} />
                            {favorite.rating.toFixed(1)} ({favorite.reviewCount})
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <p className="shrink-0 text-sm font-bold">
                        {formatKlyxFavoritePrice(
                          locale,
                          favorite.price,
                          favorite.pricingType
                        )}
                      </p>
                      <FavoriteButton
                        serviceProfileId={favorite.serviceProfileId}
                        compact
                      />
                      <Link
                        href={`/providers/${favorite.userId}`}
                        className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl bg-[#2563EB] px-4 text-sm font-bold text-white transition hover:bg-[#2563EB]/90"
                      >
                        {t("viewProfile")}
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
