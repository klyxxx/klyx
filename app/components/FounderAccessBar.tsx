import Link from "next/link";
import {
  Crown,
  ShieldCheck,
  TestTube2,
  UsersRound,
} from "lucide-react";

import FounderModeSwitcher from "@/app/components/FounderModeSwitcher";
import {
  getActiveProfile,
  getOwnedProfiles,
} from "@/lib/active-profile";
import { isKlyxFounder } from "@/lib/founder-auth";

export default async function FounderAccessBar() {
  const founder = await isKlyxFounder();

  if (!founder) {
    return null;
  }

  const [profile, profiles] =
    await Promise.all([
      getActiveProfile(),
      getOwnedProfiles(),
    ]);

  const clientProfile =
    profiles.find(
      (item) =>
        item.accountType === "client"
    ) ?? null;

  const providerProfile =
    profiles.find(
      (item) =>
        item.accountType === "provider"
    ) ?? null;

  const mode =
    profile?.accountType === "provider"
      ? "Prestataire"
      : profile?.accountType === "client"
        ? "Client"
        : "Aucun profil";

  return (
    <div className="sticky top-0 z-[70] border-b border-amber-400/15 bg-[rgba(13,10,22,0.94)] px-4 py-2.5 text-white backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1.5 text-xs font-black text-amber-200">
            <Crown size={14} />
            FOUNDER
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1.5 text-xs font-black text-violet-200">
            <ShieldCheck size={14} />
            SUPER ADMIN
          </span>

          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-black text-emerald-200">
            FULL ACCESS
          </span>

          <span className="text-xs font-bold text-white/60">
            Mode actif : {mode}
          </span>
        </div>

        <FounderModeSwitcher
          currentProfileId={
            profile?.id ?? null
          }
          clientProfileId={
            clientProfile?.id ?? null
          }
          providerProfileId={
            providerProfile?.id ?? null
          }
        />

        <nav className="flex flex-wrap items-center gap-2">
          <Link
            href="/founder"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-white px-3 text-xs font-black text-zinc-950 transition hover:bg-zinc-200"
          >
            <Crown size={14} />
            Console
          </Link>

          <Link
            href="/founder/test"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-white transition hover:bg-white/10"
          >
            <TestTube2 size={14} />
            Tests
          </Link>

          <Link
            href="/founder/cleanup"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-white transition hover:bg-white/10"
          >
            <UsersRound size={14} />
            Comptes
          </Link>

          <Link
            href="/admin"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-violet-400/20 bg-violet-500/15 px-3 text-xs font-black text-violet-100 transition hover:bg-violet-500/25"
          >
            <ShieldCheck size={14} />
            Admin
          </Link>
        </nav>
      </div>
    </div>
  );
}
