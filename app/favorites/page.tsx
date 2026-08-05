"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getActiveClientProfile } from "@/lib/account-switcher";
import FavoriteButton from "@/app/components/FavoriteButton";

type FavoriteRow = {
  id: string;
  service_profile_id: string;
};

type ServiceProfileRow = {
  id: string;
  user_service_id: string;
  title: string | null;
  price: number | null;
  city: string | null;
  rating: number | null;
  review_count: number | null;
};

type UserServiceRow = {
  id: string;
  user_id: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

type FavoriteBabysitter = {
  userId: string;
  serviceProfileId: string;
  fullName: string;
  avatarUrl: string;
  title: string;
  city: string;
  price: number | null;
  rating: number;
  reviewCount: number;
};

export default function FavoritesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<FavoriteBabysitter[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  const loadFavorites = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

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

      if (favoriteError) throw new Error(favoriteError.message);

      const favoriteList = (favoriteRows ?? []) as FavoriteRow[];

      if (favoriteList.length === 0) {
        setFavorites([]);
        return;
      }

      const serviceProfileIds = favoriteList.map(
        (favorite) => favorite.service_profile_id
      );

      const { data: serviceProfiles, error: serviceProfilesError } =
        await supabase
          .from("service_profiles")
          .select(
            "id, user_service_id, title, price, city, rating, review_count"
          )
          .in("id", serviceProfileIds);

      if (serviceProfilesError) {
        throw new Error(serviceProfilesError.message);
      }

      const typedServiceProfiles =
        (serviceProfiles ?? []) as ServiceProfileRow[];
      const userServiceIds = typedServiceProfiles.map(
        (item) => item.user_service_id
      );

      const { data: userServices, error: userServicesError } = await supabase
        .from("user_services")
        .select("id, user_id")
        .in("id", userServiceIds);

      if (userServicesError) {
        throw new Error(userServicesError.message);
      }

      const typedUserServices = (userServices ?? []) as UserServiceRow[];
      const userIds = typedUserServices.map((item) => item.user_id);

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, first_name, last_name, avatar_url")
        .in("id", userIds);

      if (profilesError) {
        throw new Error(profilesError.message);
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
            const userService = userServiceMap.get(
              serviceProfile.user_service_id
            );

            if (!userService) return null;

            const profile = profileMap.get(userService.user_id);

            if (!profile) return null;

            return {
              userId: profile.id,
              serviceProfileId: serviceProfile.id,
              fullName:
                profile.full_name?.trim() ||
                `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
                "Baby-sitter",
              avatarUrl:
                profile.avatar_url ||
                "https://placehold.co/600x400?text=Baby-sitter",
              title: serviceProfile.title ?? "Baby-sitter",
              city: serviceProfile.city ?? "Ville non renseignée",
              price: serviceProfile.price,
              rating: serviceProfile.rating ?? 0,
              reviewCount: serviceProfile.review_count ?? 0,
            } satisfies FavoriteBabysitter;
          })
          .filter((item): item is FavoriteBabysitter => item !== null)
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de charger les favoris."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadFavorites();
  }, [loadFavorites]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        Chargement...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Link href="/babysitters" className="text-sm text-zinc-400">
          Retour aux baby-sitters
        </Link>

        <h1 className="mt-6 text-4xl font-bold">Mes favoris</h1>

        {errorMessage && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
            {errorMessage}
          </div>
        )}

        {favorites.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/60 p-8">
            <p className="text-zinc-400">Tu n'as encore aucun favori.</p>

            <Link
              href="/babysitters"
              className="mt-5 inline-flex rounded-xl bg-violet-600 px-6 py-3 font-semibold hover:bg-violet-700"
            >
              Trouver une baby-sitter
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            {favorites.map((favorite) => (
              <article
                key={favorite.serviceProfileId}
                className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900"
              >
                <div className="relative">
                  <img
                    src={favorite.avatarUrl}
                    alt={favorite.fullName}
                    className="h-64 w-full object-cover"
                  />

                  <div className="absolute right-4 top-4">
                    <FavoriteButton
                      serviceProfileId={favorite.serviceProfileId}
                      compact
                    />
                  </div>
                </div>

                <div className="p-6">
                  <p className="text-sm text-violet-400">{favorite.title}</p>
                  <h2 className="mt-2 text-2xl font-bold">
                    {favorite.fullName}
                  </h2>
                  <p className="mt-3 text-zinc-400">{favorite.city}</p>

                  <p className="mt-4 font-semibold">
                    {favorite.price !== null
                      ? `${favorite.price.toFixed(2)} €/heure`
                      : "Prix non renseigné"}
                  </p>

                  <p className="mt-2 text-sm text-zinc-500">
                    {favorite.rating.toFixed(1)} / 5 ({favorite.reviewCount})
                  </p>

                  <Link
                    href={`/babysitters/${favorite.userId}`}
                    className="mt-6 inline-flex w-full justify-center rounded-xl bg-violet-600 px-6 py-3 font-semibold hover:bg-violet-700"
                  >
                    Voir le profil
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
