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

  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<"client" | "provider" | null>(
    null
  );
  const [error, setError] = useState("");

  async function switchMode(
    mode: "client" | "provider",
    profileId: string | null
  ) {
    if (!profileId || switching) {
      return;
    }

    if (profileId === currentProfileId) {
      setOpen(false);
      router.push(mode === "provider" ? "/provider" : "/dashboard");
      return;
    }

    setSwitching(mode);
    setError("");

    try {
      const response = await fetch("/api/profiles/active", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profileId,
        }),
      });

      const body = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !body.success) {
        throw new Error(body.error || "Impossible de changer de mode.");
      }

      setOpen(false);
      router.replace(mode === "provider" ? "/provider" : "/dashboard");
      router.refresh();
    } catch (switchError) {
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
    <div className="fixed bottom-3 right-3 z-[80] opacity-70 transition-opacity hover:opacity-100 focus-within:opacity-100">
      {open && (
        <div
          id="klyx-founder-internal-tools"
          className="mb-2 w-[min(90vw,300px)] overflow-hidden rounded-xl border border-dashed border-border/80 bg-background/96 text-foreground shadow-lg backdrop-blur-xl"
        >
          <div className="flex items-start justify-between border-b border-border/70 px-3 py-2.5">
            <div>
              <div className="flex items-center gap-2">
                <Crown size={14} className="text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground">
                  Outils Founder
                </p>
                <span className="rounded border border-border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Interne
                </span>
              </div>

              <p className="mt-1 text-[11px] text-muted-foreground/80">
                Mode actif:{" "}
                {currentMode === "provider"
                  ? "Prestataire"
                  : currentMode === "client"
                    ? "Client"
                    : "Aucun"}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Fermer"
            >
              <X size={15} />
            </button>
          </div>

          <div className="p-1.5">
            <button
              type="button"
              disabled={!clientProfileId || switching !== null}
              onClick={() => void switchMode("client", clientProfileId)}
              className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-xs font-semibold transition disabled:opacity-40 ${
                currentMode === "client"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {switching === "client" ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                <UserRound size={16} />
              )}

              <span className="flex-1">Client</span>
            </button>

            <button
              type="button"
              disabled={!providerProfileId || switching !== null}
              onClick={() => void switchMode("provider", providerProfileId)}
              className={`mt-0.5 flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-xs font-semibold transition disabled:opacity-40 ${
                currentMode === "provider"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {switching === "provider" ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                <BriefcaseBusiness size={16} />
              )}

              <span className="flex-1">Prestataire</span>
            </button>
          </div>

          <div className="border-t border-border/70 p-1.5">
            <Link
              href="/founder"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <Crown size={16} />
              Console Founder
            </Link>

            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <ShieldCheck size={16} />
              Centre Admin
            </Link>

            <Link
              href="/founder/test"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <TestTube2 size={16} />
              Tests Founder
            </Link>

            <Link
              href="/founder/cleanup"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <UsersRound size={16} />
              Comptes de test
            </Link>

            <Link
              href="/founder/final-check"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <CheckCircle2 size={16} />
              Validation finale
            </Link>
          </div>

          {error && (
            <p className="border-t border-border/70 px-3 py-2.5 text-xs font-semibold text-rose-600">
              {error}
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed border-border/70 bg-background/80 px-2.5 text-[11px] font-semibold text-muted-foreground shadow-sm backdrop-blur-sm transition hover:border-border hover:bg-background hover:text-foreground"
        aria-label="Ouvrir les outils internes Founder"
        aria-expanded={open}
        aria-controls="klyx-founder-internal-tools"
      >
        <Crown size={13} />
        <span>Founder</span>
        <ChevronDown
          size={12}
          className={`transition ${open ? "rotate-180" : ""}`}
        />
      </button>
    </div>
  );
}
