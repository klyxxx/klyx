"use client";

import {
  BriefcaseBusiness,
  LoaderCircle,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type FounderModeSwitcherProps = {
  currentProfileId: string | null;
  clientProfileId: string | null;
  providerProfileId: string | null;
};

export default function FounderModeSwitcher({
  currentProfileId,
  clientProfileId,
  providerProfileId,
}: FounderModeSwitcherProps) {
  const router = useRouter();
  const [switching, setSwitching] =
    useState<"client" | "provider" | null>(null);
  const [error, setError] = useState("");

  async function switchTo(
    mode: "client" | "provider",
    profileId: string | null
  ) {
    if (!profileId || switching) {
      return;
    }

    if (profileId === currentProfileId) {
      router.push(
        mode === "provider"
          ? "/provider"
          : "/dashboard"
      );
      return;
    }

    setSwitching(mode);
    setError("");

    try {
      const response = await fetch(
        "/api/profiles/active",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            profileId,
          }),
        }
      );

      const body =
        (await response.json()) as {
          success?: boolean;
          error?: string;
        };

      if (!response.ok || !body.success) {
        throw new Error(
          body.error ||
            "Impossible de changer de mode."
        );
      }

      router.replace(
        mode === "provider"
          ? "/provider"
          : "/dashboard"
      );

      router.refresh();
    } catch (switchError) {
      setError(
        switchError instanceof Error
          ? switchError.message
          : "Impossible de changer de mode."
      );
      setSwitching(null);
    }
  }

  const clientActive =
    Boolean(clientProfileId) &&
    clientProfileId === currentProfileId;

  const providerActive =
    Boolean(providerProfileId) &&
    providerProfileId === currentProfileId;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!clientProfileId || switching !== null}
          onClick={() =>
            void switchTo(
              "client",
              clientProfileId
            )
          }
          className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${
            clientActive
              ? "bg-emerald-500 text-white"
              : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
          }`}
        >
          {switching === "client" ? (
            <LoaderCircle
              size={14}
              className="animate-spin"
            />
          ) : (
            <UserRound size={14} />
          )}
          Client
        </button>

        <button
          type="button"
          disabled={!providerProfileId || switching !== null}
          onClick={() =>
            void switchTo(
              "provider",
              providerProfileId
            )
          }
          className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${
            providerActive
              ? "bg-violet-600 text-white"
              : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
          }`}
        >
          {switching === "provider" ? (
            <LoaderCircle
              size={14}
              className="animate-spin"
            />
          ) : (
            <BriefcaseBusiness size={14} />
          )}
          Prestataire
        </button>
      </div>

      {error && (
        <p className="max-w-sm text-[11px] font-bold text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}
