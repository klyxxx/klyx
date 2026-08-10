"use client";

import Link from "next/link";
import {
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  Crown,
  LoaderCircle,
  ShieldCheck,
  TestTube2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type FounderCompactMenuProps = {
  currentProfileId: string | null;
  currentMode: "client" | "provider" | null;
  clientProfileId: string | null;
  providerProfileId: string | null;
};

export default function FounderCompactMenu({
  currentProfileId,
  currentMode,
  clientProfileId,
  providerProfileId,
}: FounderCompactMenuProps) {
  const router = useRouter();

  const [open, setOpen] =
    useState(false);

  const [switching, setSwitching] =
    useState<
      "client" |
      "provider" |
      null
    >(null);

  const [error, setError] =
    useState("");

  async function switchMode(
    mode: "client" | "provider",
    profileId: string | null
  ) {
    if (
      !profileId ||
      switching
    ) {
      return;
    }

    if (
      profileId ===
      currentProfileId
    ) {
      setOpen(false);

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
      const response =
        await fetch(
          "/api/profiles/active",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                profileId,
              }),
          }
        );

      const body =
        (await response.json()) as {
          success?: boolean;
          error?: string;
        };

      if (
        !response.ok ||
        !body.success
      ) {
        throw new Error(
          body.error ||
            "Impossible de changer de mode."
        );
      }

      setOpen(false);

      router.replace(
        mode === "provider"
          ? "/provider"
          : "/dashboard"
      );

      router.refresh();
    } catch (
      switchError
    ) {
      setError(
        switchError instanceof Error
          ? switchError.message
          : "Impossible de changer de mode."
      );
    } finally {
      setSwitching(null);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-[80]">
      {open && (
        <div className="mb-3 w-[min(92vw,320px)] overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <Crown
                  size={17}
                  className="text-amber-500"
                />

                <p className="font-black">
                  Founder
                </p>

                <span className="rounded-full bg-violet-500/10 px-2 py-1 text-[10px] font-black text-violet-600">
                  ADMIN
                </span>
              </div>

              <p className="mt-1 text-xs text-muted-foreground">
                Mode actif :{" "}
                {currentMode ===
                "provider"
                  ? "Prestataire"
                  : currentMode ===
                      "client"
                    ? "Client"
                    : "Aucun"}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setOpen(false)
              }
              className="grid h-9 w-9 place-items-center rounded-xl hover:bg-muted"
              aria-label="Fermer"
            >
              <X size={17} />
            </button>
          </div>

          <div className="p-2">
            <button
              type="button"
              disabled={
                !clientProfileId ||
                switching !==
                  null
              }
              onClick={() =>
                void switchMode(
                  "client",
                  clientProfileId
                )
              }
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold transition disabled:opacity-40 ${
                currentMode ===
                "client"
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "hover:bg-muted"
              }`}
            >
              {switching ===
              "client" ? (
                <LoaderCircle
                  size={18}
                  className="animate-spin"
                />
              ) : (
                <UserRound
                  size={18}
                />
              )}

              <span className="flex-1">
                Client
              </span>
            </button>

            <button
              type="button"
              disabled={
                !providerProfileId ||
                switching !==
                  null
              }
              onClick={() =>
                void switchMode(
                  "provider",
                  providerProfileId
                )
              }
              className={`mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold transition disabled:opacity-40 ${
                currentMode ===
                "provider"
                  ? "bg-violet-500/10 text-violet-600"
                  : "hover:bg-muted"
              }`}
            >
              {switching ===
              "provider" ? (
                <LoaderCircle
                  size={18}
                  className="animate-spin"
                />
              ) : (
                <BriefcaseBusiness
                  size={18}
                />
              )}

              <span className="flex-1">
                Prestataire
              </span>
            </button>
          </div>

          <div className="border-t border-border p-2">
            <Link
              href="/founder"
              onClick={() =>
                setOpen(false)
              }
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition hover:bg-muted"
            >
              <Crown size={18} />
              Console Founder
            </Link>

            <Link
              href="/admin"
              onClick={() =>
                setOpen(false)
              }
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition hover:bg-muted"
            >
              <ShieldCheck
                size={18}
              />
              Centre Admin
            </Link>

            <Link
              href="/founder/test"
              onClick={() =>
                setOpen(false)
              }
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition hover:bg-muted"
            >
              <TestTube2
                size={18}
              />
              Tests Founder
            </Link>

            <Link
              href="/founder/cleanup"
              onClick={() =>
                setOpen(false)
              }
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition hover:bg-muted"
            >
              <UsersRound
                size={18}
              />
              Comptes de test
            </Link>

            <Link
              href="/founder/final-check"
              onClick={() =>
                setOpen(false)
              }
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition hover:bg-muted"
            >
              <CheckCircle2
                size={18}
              />
              Validation finale
            </Link>
          </div>

          {error && (
            <p className="border-t border-border px-4 py-3 text-xs font-bold text-rose-600">
              {error}
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() =>
          setOpen(
            (value) =>
              !value
          )
        }
        className="inline-flex h-11 items-center gap-2 rounded-full border border-amber-400/20 bg-background dark:bg-zinc-950 px-4 text-sm font-black text-foreground dark:text-white shadow-xl transition hover:bg-card dark:bg-zinc-900"
        aria-expanded={open}
      >
        <Crown
          size={16}
          className="text-amber-400"
        />

        Founder

        <ChevronDown
          size={15}
          className={`transition ${
            open
              ? "rotate-180"
              : ""
          }`}
        />
      </button>
    </div>
  );
}
