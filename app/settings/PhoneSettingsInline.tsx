"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  CheckCircle2,
  LoaderCircle,
  MessageSquareText,
  Phone,
  Save,
  Send,
  ShieldCheck,
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
    <section className="mb-7 rounded-2xl border border-blue-600/20 bg-blue-600/[0.04] p-6 sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-blue-600 text-white">
            <Phone size={21} />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-semibold">{t("title")}</h2>
              {verified ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-500">
                  <CheckCircle2 size={14} />
                  {t("verified")}
                </span>
              ) : (
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-500">
                  {t("needsVerification")}
                </span>
              )}
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {t("privacyDescription")}
            </p>
          </div>
        </div>
        <ShieldCheck size={22} className="hidden shrink-0 text-emerald-500 sm:block" />
      </div>

      {loading ? (
        <div className="mt-6 flex items-center gap-3 text-sm font-medium text-muted-foreground">
          <LoaderCircle size={19} className="animate-spin text-blue-600" />
          {t("loadingPhone")}
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row">
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
              className="h-13 min-w-0 flex-1 rounded-xl border border-border bg-background px-5 text-base font-semibold outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-600/8"
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void savePhone()}
              className="inline-flex h-13 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
            >
              {saving ? <LoaderCircle size={18} className="animate-spin" /> : <Save size={18} />}
              {t("save")}
            </button>
          </div>

          <p className="text-xs font-medium text-muted-foreground">
            {t("internationalFormat")}
          </p>

          {!verified && savedPhone && !unsaved && (
            <div className="rounded-2xl border border-border bg-background/60 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <MessageSquareText size={20} className="mt-0.5 shrink-0 text-blue-600" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{t("smsTitle")}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {t("smsDescription")}
                  </p>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      disabled={sendingOtp || cooldown > 0}
                      onClick={() => void sendOtp()}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
                    >
                      {sendingOtp ? <LoaderCircle size={17} className="animate-spin" /> : <Send size={17} />}
                      {cooldown > 0
                        ? t("resendIn", { seconds: cooldown })
                        : t("sendCode")}
                    </button>
                  </div>

                  {otpSent && (
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <input
                        value={otpCode}
                        onChange={(event) =>
                          setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 10))
                        }
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder={t("codePlaceholder")}
                        className="h-12 min-w-0 flex-1 rounded-xl border border-border bg-background px-4 text-center text-lg font-semibold tracking-[0.25em] outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-600/8"
                      />
                      <button
                        type="button"
                        disabled={verifyingOtp}
                        onClick={() => void verifyOtp()}
                        className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {verifyingOtp ? <LoaderCircle size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
                        {t("verify")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {verified && (
            <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-500">
              <CheckCircle2 size={18} />
              {t("verifiedByKlyx")}
            </div>
          )}

          {message && (
            <div className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-500">
              {t(message.key, message.variables)}
            </div>
          )}

          {errorKey && (
            <div className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-500">
              {t(errorKey)}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
