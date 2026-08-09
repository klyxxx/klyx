"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Heart, MapPin, Search, Star } from "lucide-react";
import FavoriteButton from "@/app/components/FavoriteButton";
import { getActiveClientProfile } from "@/lib/account-switcher";
import { supabase } from "@/lib/supabase";

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

function displayPrice(favorite: FavoriteProvider): string {
  if (favorite.price === null) return "Prix à confirmer";
  return favorite.pricingType === "fixed"
    ? `${favorite.price.toFixed(2)} € forfait`
    : `${favorite.price.toFixed(2)} €/h`;
}

export default function FavoritesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<FavoriteProvider[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  const loadFavorites = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
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
      const serviceProfileIds = favoriteList.map((favorite) => favorite.service_profile_id);
      const { data: serviceProfiles, error: serviceProfilesError } = await supabase
        .from("service_profiles")
        .select("id, user_service_id, title, pricing_type, price, hourly_price, fixed_price, city, rating, review_count")
        .in("id", serviceProfileIds);
      if (serviceProfilesError) throw new Error(serviceProfilesError.message);
      const typedServiceProfiles = (serviceProfiles ?? []) as ServiceProfileRow[];
      const userServiceIds = typedServiceProfiles.map((item) => item.user_service_id);
      const { data: userServices, error: userServicesError } = await supabase
        .from("user_services")
        .select("id, user_id")
        .in("id", userServiceIds);
      if (userServicesError) throw new Error(userServicesError.message);
      const typedUserServices = (userServices ?? []) as UserServiceRow[];
      const userIds = typedUserServices.map((item) => item.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, first_name, last_name, avatar_url")
        .in("id", userIds);
      if (profilesError) throw new Error(profilesError.message);
      const userServiceMap = new Map(typedUserServices.map((item) => [item.id, item]));
      const profileMap = new Map(((profiles ?? []) as ProfileRow[]).map((item) => [item.id, item]));
      setFavorites(
        typedServiceProfiles
          .map((serviceProfile) => {
            const userService = userServiceMap.get(serviceProfile.user_service_id);
            if (!userService) return null;
            const profile = profileMap.get(userService.user_id);
            if (!profile) return null;
            const pricingType: "hourly" | "fixed" =
              serviceProfile.pricing_type === "fixed" ? "fixed" : "hourly";
            const dedicatedPrice = pricingType === "fixed"
              ? serviceProfile.fixed_price
              : serviceProfile.hourly_price;
            const price = dedicatedPrice ?? serviceProfile.price;
            return {
              userId: profile.id,
              serviceProfileId: serviceProfile.id,
              fullName:
                profile.full_name?.trim() ||
                `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
                "Prestataire KLYX",
              avatarUrl: profile.avatar_url,
              title: serviceProfile.title ?? "Service KLYX",
              city: serviceProfile.city ?? "Zone à confirmer",
              pricingType,
              price: price == null ? null : Number(price),
              rating: Number(serviceProfile.rating ?? 0),
              reviewCount: Number(serviceProfile.review_count ?? 0),
            } satisfies FavoriteProvider;
          })
          .filter((item): item is FavoriteProvider => item !== null)
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Impossible de charger les favoris.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void loadFavorites(); }, [loadFavorites]);

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-zinc-950 text-white"><p className="text-sm text-zinc-400">Chargement des favoris...</p></main>;
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-zinc-950 px-3 py-5 text-white sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto min-w-0 max-w-7xl">
        <Link href="/search" className="inline-flex items-center gap-2 text-sm font-bold text-zinc-400 transition hover:text-white"><ArrowLeft size={17} />Retour à la recherche</Link>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">KLYX</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">Mes favoris</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">Retrouve ici tous les prestataires et services que tu as enregistrés.</p>
          </div>
          <Link href="/search" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-black transition hover:bg-violet-700"><Search size={17} />Trouver un service</Link>
        </div>
        {errorMessage && <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{errorMessage}</div>}
        {favorites.length === 0 ? (
          <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/60 p-7 text-center sm:p-10">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet-500/10 text-violet-300"><Heart size={25} /></span>
            <h2 className="mt-5 text-xl font-black">Aucun favori pour le moment</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">Explore les services KLYX et ajoute les prestataires qui t’intéressent.</p>
            <Link href="/search" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-6 text-sm font-black transition hover:bg-violet-700"><Search size={17} />Trouver un service</Link>
          </section>
        ) : (
          <div className="mt-8 grid min-w-0 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {favorites.map((favorite) => (
              <article key={favorite.serviceProfileId} className="min-w-0 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900">
                <div className="relative aspect-[16/10] overflow-hidden bg-zinc-800">
                  {favorite.avatarUrl ? <img src={favorite.avatarUrl} alt={favorite.fullName} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-center text-zinc-500"><div><Heart className="mx-auto" size={30} /><p className="mt-2 text-xs font-bold">Prestataire KLYX</p></div></div>}
                  <div className="absolute right-3 top-3"><FavoriteButton serviceProfileId={favorite.serviceProfileId} compact /></div>
                </div>
                <div className="min-w-0 p-5">
                  <p className="truncate text-sm font-bold text-violet-300">{favorite.title}</p>
                  <h2 className="mt-2 truncate text-xl font-black">{favorite.fullName}</h2>
                  <p className="mt-3 flex min-w-0 items-center gap-2 text-sm text-zinc-400"><MapPin size={16} className="shrink-0" /><span className="truncate">{favorite.city}</span></p>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="font-black">{displayPrice(favorite)}</p><p className="inline-flex items-center gap-1 text-sm text-zinc-400"><Star size={15} />{favorite.rating.toFixed(1)} ({favorite.reviewCount})</p></div>
                  <Link href={`/providers/${favorite.userId}`} className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-violet-600 px-5 text-sm font-black transition hover:bg-violet-700">Voir le profil</Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
