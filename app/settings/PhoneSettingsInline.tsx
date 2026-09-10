"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  CheckCircle2,
  LoaderCircle,
  Phone,
  Save,
  Send,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  resolveKlyxPhoneSettingsPublicErrorKey,
  translateKlyxPhoneSettings,
  type KlyxPhoneSettingsMessageKey,
} from "@/lib/klyx-phone-settings-i18n";

// KLYX_PHONE_OTP_UI_12_69
// KLYX_PHONE_SETTINGS_I18N_16_06
// KLYX_PHONE_SETTINGS_SINGLE_BLUE
// KLYX_PHONE_COMPACT_UI_20260910

type PhonePayload = {
  phoneNumber?: string | null;
  verified?: boolean;
  verifiedAt?: string | null;
  error?: string;
};

type OtpPayload = {
  sent?: boolean;
  verified?: boolean;
  alreadyVerified?: boolean;
  maskedPhone?: string;
  retryAfter?: number;
  error?: string;
};

type LocalizedMessage = {
  key: KlyxPhoneSettingsMessageKey;
  variables?: Readonly<Record<string, string | number>>;
};

export default function PhoneSettingsInline() {
  const { locale } = useKlyxLocale();
  const t = (
    key: KlyxPhoneSettingsMessageKey,
    variables?: Readonly<Record<string, string | number>>
  ) => translateKlyxPhoneSettings(locale, key, variables);

  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) return null;
    return createBrowserClient(url, key);
  }, []);

  const [phoneNumber, setPhoneNumber] = useState("");
  const [savedPhone, setSavedPhone] = useState("");
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [message, setMessage] = useState<LocalizedMessage | null>(null);
  const [errorKey, setErrorKey] = useState<KlyxPhoneSettingsMessageKey | null>(null);
  const [cooldown, setCooldown] = useState(0);

  async function getToken() {
    if (!supabase) throw new Error("Configuration Supabase manquante.");
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) throw new Error("Session KLYX introuvable.");
    return data.session.access_token;
  }

  useEffect(() => {
    let mounted = true;

    async function loadPhone() {
      try {
        const token = await getToken();
        const response = await fetch("/api/profile/phone", {
          cache: "no-store",
          headers: { Authorization: "Bearer " + token },
        });
        const result = (await response.json()) as PhonePayload;

        if (!response.ok) {
          if (mounted) {
            setErrorKey(
              resolveKlyxPhoneSettingsPublicErrorKey(result.error, "loadFailed")
            );
          }
          return;
        }

        if (!mounted) return;
        const value = result.phoneNumber ?? "";
        setPhoneNumber(value);
        setSavedPhone(value);
        setVerified(Boolean(result.verified));
      } catch (error) {
        if (!mounted) return;
        setErrorKey(
          resolveKlyxPhoneSettingsPublicErrorKey(
            error instanceof Error ? error.message : undefined,
            "loadFailed"
          )
        );
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadPhone();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function savePhone() {
    setSaving(true);
    setMessage(null);
    setErrorKey(null);

    try {
      const token = await getToken();
      const response = await fetch("/api/profile/phone", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ phoneNumber }),
      });
      const result = (await response.json()) as PhonePayload;

      if (!response.ok) {
        setErrorKey(
          resolveKlyxPhoneSettingsPublicErrorKey(result.error, "saveFailed")
        );
        return;
      }

      const value = result.phoneNumber ?? "";
      setPhoneNumber(value);
      setSavedPhone(value);
      setVerified(Boolean(result.verified));
      setOtpSent(false);
      setOtpCode("");
      setMessage({ key: value ? "phoneSaved" : "phoneRemoved" });
    } catch (error) {
      setErrorKey(
        resolveKlyxPhoneSettingsPublicErrorKey(
          error instanceof Error ? error.message : undefined,
          "saveFailed"
        )
      );
    } finally {
      setSaving(false);
    }
  }

  async function sendOtp() {
    if (!savedPhone) {
      setErrorKey("savePhoneBeforeCode");
      return;
    }

    if (phoneNumber !== savedPhone) {
      setErrorKey("saveNewPhoneBeforeVerify");
      return;
    }

    setSendingOtp(true);
    setMessage(null);
    setErrorKey(null);

    try {
      const token = await getToken();
      const response = await fetch("/api/profile/phone/otp/send", {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
      });
      const result = (await response.json()) as OtpPayload;

      if (!response.ok) {
        if (result.retryAfter) setCooldown(result.retryAfter);
        setErrorKey(
          resolveKlyxPhoneSettingsPublicErrorKey(result.error, "sendFailed")
        );
        return;
      }

      if (result.alreadyVerified) {
        setVerified(true);
        setMessage({ key: "alreadyVerified" });
        return;
      }

      setOtpSent(true);
      setCooldown(result.retryAfter ?? 60);
      setMessage({
        key: "codeSent",
        variables: { phone: result.maskedPhone ?? savedPhone },
      });
    } catch (error) {
      setErrorKey(
        resolveKlyxPhoneSettingsPublicErrorKey(
          error instanceof Error ? error.message : undefined,
          "sendFailed"
        )
      );
    } finally {
      setSendingOtp(false);
    }
  }

  async function verifyOtp() {
    const cleanCode = otpCode.replace(/\D/g, "");

    if (cleanCode.length < 4) {
      setErrorKey("invalidOtp");
      return;
    }

    setVerifyingOtp(true);
    setMessage(null);
    setErrorKey(null);

    try {
      const token = await getToken();
      const response = await fetch("/api/profile/phone/otp/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ code: cleanCode }),
      });
      const result = (await response.json()) as OtpPayload;

      if (!response.ok) {
        setErrorKey(
          resolveKlyxPhoneSettingsPublicErrorKey(result.error, "verifyFailed")
        );
        return;
      }

      setVerified(true);
      setOtpSent(false);
      setOtpCode("");
      setMessage({ key: "phoneVerifiedSuccess" });
    } catch (error) {
      setErrorKey(
        resolveKlyxPhoneSettingsPublicErrorKey(
          error instanceof Error ? error.message : undefined,
          "verifyFailed"
        )
      );
    } finally {
      setVerifyingOtp(false);
    }
  }

  const unsaved = phoneNumber !== savedPhone;

  return (
    <section className="mb-0 rounded-xl border border-border bg-background p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-600/10 text-blue-600">
            <Phone size={16} />
          </span>
          <h2 className="truncate text-sm font-semibold">{t("title")}</h2>
        </div>

        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
            verified
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
          }`}
        >
          {verified && <CheckCircle2 size={13} />}
          {verified ? t("verified") : t("needsVerification")}
        </span>
      </div>

      {loading ? (
        <div className="mt-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <LoaderCircle size={16} className="animate-spin text-blue-600" />
          {t("loadingPhone")}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phoneNumber}
              onChange={(event) => {
                setPhoneNumber(event.target.value);
                setMessage(null);
                setErrorKey(null);
              }}
              placeholder="+32471503513"
              aria-label={t("title")}
              className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm font-semibold outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-600/8"
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void savePhone()}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
            >
              {saving ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              {t("save")}
            </button>
          </div>

          <p className="text-[11px] font-medium leading-4 text-muted-foreground">
            {t("internationalFormat")}
          </p>

          {!verified && savedPhone && !unsaved && (
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{t("smsTitle")}</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                    {t("smsDescription")}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={sendingOtp || cooldown > 0}
                  onClick={() => void sendOtp()}
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
                >
                  {sendingOtp ? (
                    <LoaderCircle size={15} className="animate-spin" />
                  ) : (
                    <Send size={15} />
                  )}
                  {cooldown > 0
                    ? t("resendIn", { seconds: cooldown })
                    : t("sendCode")}
                </button>
              </div>

              {otpSent && (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={otpCode}
                    onChange={(event) =>
                      setOtpCode(
                        event.target.value.replace(/\D/g, "").slice(0, 10)
                      )
                    }
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder={t("codePlaceholder")}
                    className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-center text-sm font-semibold tracking-[0.2em] outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-600/8"
                  />
                  <button
                    type="button"
                    disabled={verifyingOtp}
                    onClick={() => void verifyOtp()}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {verifyingOtp ? (
                      <LoaderCircle size={15} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={15} />
                    )}
                    {t("verify")}
                  </button>
                </div>
              )}
            </div>
          )}

          {message && (
            <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {t(message.key, message.variables)}
            </div>
          )}

          {errorKey && (
            <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-500">
              {t(errorKey)}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
