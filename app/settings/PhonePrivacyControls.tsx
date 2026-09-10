"use client";

import { useCallback, useEffect, useState } from "react";
import { EyeOff, LoaderCircle, Users } from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  resolveKlyxPhonePrivacyPublicErrorKey,
  translateKlyxPhonePrivacy,
  type KlyxPhonePrivacyMessageKey,
} from "@/lib/klyx-phone-privacy-i18n";
import { supabase } from "@/lib/supabase";

// KLYX_PHONE_PRIVACY_UI_12_75
// KLYX_PHONE_PRIVACY_I18N_16_07
// KLYX_PHONE_PRIVACY_SINGLE_BLUE
// KLYX_PHONE_PRIVACY_COMPACT_20260910

type Visibility = "private" | "transaction_participants";

type PrivacyPayload = {
  visibility?: Visibility;
  hasPhone?: boolean;
  verified?: boolean;
  saved?: boolean;
  error?: string;
};

export default function PhonePrivacyControls() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxPhonePrivacyMessageKey) =>
    translateKlyxPhonePrivacy(locale, key);

  const [visibility, setVisibility] =
    useState<Visibility>("transaction_participants");
  const [hasPhone, setHasPhone] = useState(false);
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Visibility | null>(null);
  const [messageKey, setMessageKey] =
    useState<KlyxPhonePrivacyMessageKey | null>(null);
  const [errorKey, setErrorKey] =
    useState<KlyxPhonePrivacyMessageKey | null>(null);

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const loadPrivacy = useCallback(async () => {
    setLoading(true);

    try {
      const token = await getToken();
      if (!token) {
        setErrorKey("sessionMissing");
        return;
      }

      const response = await fetch("/api/profile/phone/privacy", {
        cache: "no-store",
        headers: { Authorization: "Bearer " + token },
      });
      const result = (await response.json()) as PrivacyPayload;

      if (!response.ok) {
        setErrorKey(
          resolveKlyxPhonePrivacyPublicErrorKey(result.error, "loadFailed")
        );
        return;
      }

      setVisibility(result.visibility ?? "transaction_participants");
      setHasPhone(Boolean(result.hasPhone));
      setVerified(Boolean(result.verified));
    } catch {
      setErrorKey("loadFailed");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void loadPrivacy();
  }, [loadPrivacy]);

  async function changeVisibility(nextVisibility: Visibility) {
    if (nextVisibility === visibility) return;

    setSaving(nextVisibility);
    setMessageKey(null);
    setErrorKey(null);

    try {
      const token = await getToken();
      if (!token) {
        setErrorKey("sessionMissing");
        return;
      }

      const response = await fetch("/api/profile/phone/privacy", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ visibility: nextVisibility }),
      });
      const result = (await response.json()) as PrivacyPayload;

      if (!response.ok) {
        setErrorKey(
          resolveKlyxPhonePrivacyPublicErrorKey(result.error, "saveFailed")
        );
        return;
      }

      setVisibility(result.visibility ?? nextVisibility);
      setHasPhone(Boolean(result.hasPhone));
      setVerified(Boolean(result.verified));
      setMessageKey(
        nextVisibility === "private" ? "privateSaved" : "participantsSaved"
      );
    } catch {
      setErrorKey("saveFailed");
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <section className="rounded-xl border border-border bg-background px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <LoaderCircle size={17} className="animate-spin text-blue-600" />
          {t("loading")}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-background p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{t("title")}</h2>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            {t("description")}
          </p>
        </div>
        {saving && (
          <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <LoaderCircle size={14} className="animate-spin" />
            {t("saving")}
          </span>
        )}
      </div>

      {!hasPhone && (
        <div className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
          {t("phoneRequired")}
        </div>
      )}

      {hasPhone && !verified && (
        <div className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
          {t("verificationRequired")}
        </div>
      )}

      <div
        className="mt-3 grid gap-2 sm:grid-cols-2"
        role="group"
        aria-label={t("title")}
      >
        <button
          type="button"
          disabled={saving !== null}
          aria-pressed={visibility === "transaction_participants"}
          onClick={() => void changeVisibility("transaction_participants")}
          className={
            "flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600/15 " +
            (visibility === "transaction_participants"
              ? "border-blue-600 bg-blue-600/[0.06]"
              : "border-border bg-background hover:border-blue-600/35")
          }
        >
          <Users size={18} className="shrink-0 text-blue-600" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold">
              {t("participantsTitle")}
            </span>
            <span className="block text-xs leading-5 text-muted-foreground">
              {t("participantsDescription")}
            </span>
          </span>
        </button>

        <button
          type="button"
          disabled={saving !== null}
          aria-pressed={visibility === "private"}
          onClick={() => void changeVisibility("private")}
          className={
            "flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600/15 " +
            (visibility === "private"
              ? "border-blue-600 bg-blue-600/[0.06]"
              : "border-border bg-background hover:border-blue-600/35")
          }
        >
          <EyeOff size={18} className="shrink-0 text-blue-600" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{t("privateTitle")}</span>
            <span className="block text-xs leading-5 text-muted-foreground">
              {t("privateDescription")}
            </span>
          </span>
        </button>
      </div>

      {messageKey && (
        <div className="mt-3 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          {t(messageKey)}
        </div>
      )}

      {errorKey && (
        <div className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400">
          {t(errorKey)}
        </div>
      )}
    </section>
  );
}
