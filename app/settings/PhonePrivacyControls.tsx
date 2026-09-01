"use client";

import { useCallback, useEffect, useState } from "react";
import { EyeOff, LoaderCircle, ShieldCheck, Users } from "lucide-react";

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
      <section className="mb-7 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
          <LoaderCircle size={19} className="animate-spin text-blue-600" />
          {t("loading")}
        </div>
      </section>
    );
  }

  return (
    <section className="mb-7 rounded-2xl border border-border bg-card p-6 sm:p-7">
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-blue-600/8 text-blue-600">
          <ShieldCheck size={22} />
        </div>
        <div>
          <h2 className="text-xl font-semibold">{t("title")}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {t("description")}
          </p>
        </div>
      </div>

      {!hasPhone && (
        <div className="mt-5 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-600 dark:text-amber-400">
          {t("phoneRequired")}
        </div>
      )}

      {hasPhone && !verified && (
        <div className="mt-5 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-600 dark:text-amber-400">
          {t("verificationRequired")}
        </div>
      )}

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <button
          type="button"
          disabled={saving !== null}
          onClick={() => void changeVisibility("transaction_participants")}
          className={
            "flex min-h-28 items-start gap-4 rounded-2xl border p-5 text-left transition " +
            (visibility === "transaction_participants"
              ? "border-blue-600 bg-blue-600/[0.07]"
              : "border-border bg-background hover:border-blue-600/40")
          }
        >
          <Users size={21} className="mt-0.5 shrink-0 text-blue-600" />
          <span>
            <span className="block font-semibold">{t("participantsTitle")}</span>
            <span className="mt-1 block text-sm leading-6 text-muted-foreground">
              {t("participantsDescription")}
            </span>
          </span>
        </button>

        <button
          type="button"
          disabled={saving !== null}
          onClick={() => void changeVisibility("private")}
          className={
            "flex min-h-28 items-start gap-4 rounded-2xl border p-5 text-left transition " +
            (visibility === "private"
              ? "border-red-500 bg-red-500/[0.06]"
              : "border-border bg-background hover:border-red-500/40")
          }
        >
          <EyeOff size={21} className="mt-0.5 shrink-0 text-red-500" />
          <span>
            <span className="block font-semibold">{t("privateTitle")}</span>
            <span className="mt-1 block text-sm leading-6 text-muted-foreground">
              {t("privateDescription")}
            </span>
          </span>
        </button>
      </div>

      {saving && (
        <div className="mt-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <LoaderCircle size={16} className="animate-spin" />
          {t("saving")}
        </div>
      )}

      {messageKey && (
        <div className="mt-4 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-500">
          {t(messageKey)}
        </div>
      )}

      {errorKey && (
        <div className="mt-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-500">
          {t(errorKey)}
        </div>
      )}
    </section>
  );
}
