"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  LoaderCircle,
  Plus,
  UserRound,
} from "lucide-react";
import {
  getSavedAccounts,
  saveCurrentAccount,
  switchToSavedAccount,
  type SavedKlyxAccount,
} from "@/lib/account-switcher";

export default function AccountSwitcher() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [accounts, setAccounts] = useState<SavedKlyxAccount[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [open, setOpen] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadAccounts() {
      const saved = await saveCurrentAccount();
      setAccounts(getSavedAccounts());
      setCurrentUserId(saved?.id ?? "");
    }

    void loadAccounts();
  }, []);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
    };
  }, []);

  async function switchAccount(accountId: string) {
    if (accountId === currentUserId || switchingId) {
      setOpen(false);
      return;
    }

    setSwitchingId(accountId);
    setErrorMessage("");

    try {
      const account = await switchToSavedAccount(accountId);

      setCurrentUserId(account.id);
      setAccounts(getSavedAccounts());
      setOpen(false);

      // Navigation complète volontaire :
      // sidebar, middleware, Server Components et données
      // sont immédiatement resynchronisés avec la nouvelle session.
      window.location.replace(
        `/dashboard?account=${encodeURIComponent(account.id)}`
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Changement de compte impossible."
      );
      setSwitchingId(null);
    }
  }

  const current =
    accounts.find((account) => account.id === currentUserId) ?? null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={Boolean(switchingId)}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-w-56 items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 font-semibold shadow-sm backdrop-blur-xl transition hover:border-violet-500/35 hover:bg-violet-500/[0.08] disabled:cursor-wait disabled:opacity-70"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
            {switchingId ? (
              <LoaderCircle className="animate-spin" size={18} />
            ) : (
              <UserRound size={18} />
            )}
          </span>

          <span className="min-w-0 text-left">
            <span className="block truncate text-sm">
              {current?.label || current?.email || "Compte actif"}
            </span>
            <span className="block truncate text-xs font-normal text-zinc-500">
              {switchingId
                ? "Synchronisation..."
                : current?.accountType === "provider"
                  ? "Compte prestataire"
                  : "Compte client"}
            </span>
          </span>
        </span>

        <ChevronDown
          size={18}
          className={`shrink-0 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 z-[120] mt-3 w-80 overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/95 shadow-2xl backdrop-blur-2xl">
          <div className="border-b border-white/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
              Changer de profil KLYX
            </p>
          </div>

          <div className="max-h-72 overflow-y-auto p-2">
            {accounts.map((account) => {
              const active = account.id === currentUserId;
              const switching = account.id === switchingId;

              return (
                <button
                  key={account.id}
                  type="button"
                  disabled={Boolean(switchingId)}
                  onClick={() => void switchAccount(account.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition disabled:opacity-60 ${
                    active
                      ? "border-violet-500/30 bg-violet-500/15"
                      : "border-transparent hover:bg-white/[0.05]"
                  }`}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-violet-300">
                    {switching ? (
                      <LoaderCircle className="animate-spin" size={18} />
                    ) : (
                      <UserRound size={19} />
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-black">
                      {account.label}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-zinc-500">
                      {account.email}
                    </span>
                    <span className="mt-1 block text-[10px] font-black uppercase tracking-wide text-zinc-600">
                      {account.accountType === "provider"
                        ? "Prestataire"
                        : "Client"}
                    </span>
                  </span>

                  {active && <Check size={18} className="text-violet-300" />}
                </button>
              );
            })}
          </div>

          {errorMessage && (
            <div className="mx-3 mb-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              {errorMessage}
            </div>
          )}

          <div className="border-t border-white/10 p-2">
            <Link
              href="/accounts"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-2xl p-3 font-black transition hover:bg-white/[0.05]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white">
                <Plus size={18} />
              </span>
              Gérer mes comptes
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
