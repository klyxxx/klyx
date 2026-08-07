"use client";

import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type KlyxAccountType = "client" | "provider";

export type SavedKlyxAccount = {
  id: string;
  label: string;
  email: string;
  accountType: KlyxAccountType;
  session: {
    access_token: string;
    refresh_token: string;
  };
};

export const KLYX_ACCOUNT_CHANGED_EVENT = "klyx-account-changed";

const STORAGE_KEY = "klyx-saved-accounts-v3";
const ACTIVE_ACCOUNT_KEY = "klyx-active-account-id-v3";

function readAccounts(): SavedKlyxAccount[] {
  if (typeof window === "undefined") return [];

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as SavedKlyxAccount[];
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (account) =>
        account &&
        typeof account.id === "string" &&
        typeof account.email === "string" &&
        (account.accountType === "client" ||
          account.accountType === "provider") &&
        typeof account.session?.access_token === "string" &&
        typeof account.session?.refresh_token === "string"
    );
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

function writeAccounts(accounts: SavedKlyxAccount[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

function setActiveAccountId(
  accountId: string,
  accountType?: KlyxAccountType
) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(ACTIVE_ACCOUNT_KEY, accountId);
  window.dispatchEvent(
    new CustomEvent(KLYX_ACCOUNT_CHANGED_EVENT, {
      detail: {
        accountId,
        accountType: accountType ?? null,
        changedAt: Date.now(),
      },
    })
  );
}

function accountFromSession(params: {
  label: string;
  accountType: KlyxAccountType;
  session: Session;
}): SavedKlyxAccount {
  return {
    id: params.session.user.id,
    label:
      params.label.trim() ||
      params.session.user.email ||
      "Compte KLYX",
    email: params.session.user.email || "",
    accountType: params.accountType,
    session: {
      access_token: params.session.access_token,
      refresh_token: params.session.refresh_token,
    },
  };
}

export function getSavedAccounts(): SavedKlyxAccount[] {
  return readAccounts();
}

export function getActiveAccountId(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ACTIVE_ACCOUNT_KEY) ?? "";
}

export function getActiveSavedAccount(): SavedKlyxAccount | null {
  const activeId = getActiveAccountId();
  return readAccounts().find((account) => account.id === activeId) ?? null;
}

export async function saveCurrentAccount(params?: {
  label?: string;
  accountType?: KlyxAccountType;
}): Promise<SavedKlyxAccount | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return null;

  const accounts = readAccounts();
  const existing = accounts.find(
    (account) => account.id === session.user.id
  );

  const saved = accountFromSession({
    label:
      params?.label ||
      existing?.label ||
      session.user.email ||
      "Compte KLYX",
    accountType:
      params?.accountType ||
      existing?.accountType ||
      "client",
    session,
  });

  writeAccounts([
    ...accounts.filter((account) => account.id !== saved.id),
    saved,
  ]);

  setActiveAccountId(saved.id, saved.accountType);
  return saved;
}

export async function addAccountWithPassword(params: {
  label: string;
  email: string;
  password: string;
  accountType: KlyxAccountType;
}): Promise<SavedKlyxAccount> {
  await saveCurrentAccount();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: params.email.trim(),
    password: params.password,
  });

  if (error || !data.session || !data.user) {
    throw new Error(error?.message || "Connexion impossible.");
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ current_mode: params.accountType })
    .eq("id", data.user.id);

  if (profileError) {
    throw new Error(
      `Compte connecté, mais type impossible à enregistrer : ${profileError.message}`
    );
  }

  const saved = accountFromSession({
    label: params.label,
    accountType: params.accountType,
    session: data.session,
  });

  const accounts = readAccounts();
  writeAccounts([
    ...accounts.filter((account) => account.id !== saved.id),
    saved,
  ]);

  const {
    data: refreshed,
    error: refreshError,
  } = await supabase.auth.refreshSession();

  if (refreshError || !refreshed.session) {
    throw new Error(
      refreshError?.message ||
        "Impossible d’activer le nouveau compte."
    );
  }

  const finalAccount = accountFromSession({
    label: saved.label,
    accountType: saved.accountType,
    session: refreshed.session,
  });

  writeAccounts([
    ...readAccounts().filter((account) => account.id !== finalAccount.id),
    finalAccount,
  ]);

  setActiveAccountId(finalAccount.id, finalAccount.accountType);
  return finalAccount;
}

export async function switchToSavedAccount(
  accountId: string
): Promise<SavedKlyxAccount> {
  const current = getActiveSavedAccount();

  if (current?.id !== accountId) {
    await saveCurrentAccount();
  }

  const account = readAccounts().find((item) => item.id === accountId);

  if (!account) {
    throw new Error("Compte enregistré introuvable.");
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: account.session.access_token,
    refresh_token: account.session.refresh_token,
  });

  if (error || !data.session) {
    throw new Error(
      "La session de ce compte a expiré. Reconnecte-le une seule fois."
    );
  }

  const refreshed = accountFromSession({
    label: account.label,
    accountType: account.accountType,
    session: data.session,
  });

  writeAccounts([
    ...readAccounts().filter((item) => item.id !== refreshed.id),
    refreshed,
  ]);

  setActiveAccountId(refreshed.id, refreshed.accountType);
  return refreshed;
}

export function removeSavedAccount(accountId: string) {
  writeAccounts(
    readAccounts().filter((account) => account.id !== accountId)
  );
}
