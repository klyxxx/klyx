"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getActiveClientProfile } from "@/lib/account-switcher";

type FavoriteButtonProps = {
  serviceProfileId: string;
  compact?: boolean;
};

export default function FavoriteButton({
  serviceProfileId,
  compact = false,
}: FavoriteButtonProps) {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [favoriteId, setFavoriteId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadFavorite();
  }, [serviceProfileId]);

  async function loadFavorite() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setUserId("");
      setFavoriteId("");
      setLoading(false);
      return;
    }

    const activeProfile = await getActiveClientProfile();

    if (activeProfile.accountType !== "client") {
      setUserId("");
      setFavoriteId("");
      setLoading(false);
      return;
    }

    setUserId(activeProfile.id);

    const { data } = await supabase
      .from("favorites")
      .select("id")
      .eq("user_id", activeProfile.id)
      .eq("service_profile_id", serviceProfileId)
      .maybeSingle();

    setFavoriteId(data?.id ?? "");
    setLoading(false);
  }

  async function toggleFavorite() {
    if (!userId) {
      router.push("/login");
      return;
    }

    setSaving(true);

    if (favoriteId) {
      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("id", favoriteId)
        .eq("user_id", userId);

      if (!error) {
        setFavoriteId("");
      }
    } else {
      const { data, error } = await supabase
        .from("favorites")
        .insert({
          user_id: userId,
          service_profile_id: serviceProfileId,
        })
        .select("id")
        .single();

      if (!error && data) {
        setFavoriteId(data.id);
      }
    }

    setSaving(false);
  }

  const isFavorite = Boolean(favoriteId);

  return (
    <button
      type="button"
      onClick={toggleFavorite}
      disabled={loading || saving}
      className={
        compact
          ? "flex h-11 w-11 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950/90 text-xl transition hover:bg-zinc-800 disabled:opacity-50"
          : "inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-5 py-3 font-semibold transition hover:bg-zinc-800 disabled:opacity-50"
      }
      aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
    >
      <span aria-hidden="true">{isFavorite ? "♥" : "♡"}</span>

      {!compact && (
        <span>
          {saving
            ? "Mise à jour..."
            : isFavorite
              ? "Retirer des favoris"
              : "Ajouter aux favoris"}
        </span>
      )}
    </button>
  );
}
