"use client";

import { FormEvent, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, LoaderCircle, ShieldAlert } from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import KlyxSelect from "@/app/components/KlyxSelect";
import { getActiveClientProfile } from "@/lib/account-switcher";
import {
  getKlyxTrustIntlLocale,
  translateKlyxTrustReason,
  translateKlyxTrustStatus,
} from "@/lib/klyx-trust-page-i18n";
import {
  translateKlyxTrustNew,
  type KlyxTrustNewMessageKey,
} from "@/lib/klyx-trust-new-i18n";
import { supabase } from "@/lib/supabase";

// KLYX_TRUST_NEW_I18N

type Booking = {
  id: string;
  booking_date: string;
  start_time: string;
  status: string;
};

const REASON_VALUES = [
  "provider_absent",
  "client_absent",
  "major_delay",
  "unfinished_work",
  "unsatisfactory_work",
  "unsafe_behavior",
  "payment_problem",
  "other",
] as const;

export default function NewDisputePage() {
  const router = useRouter();
  const { locale } = useKlyxLocale();
  const t = (key: KlyxTrustNewMessageKey) => translateKlyxTrustNew(locale, key);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingId, setBookingId] = useState("");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const bookingOptions = useMemo(
    () =>
      bookings.map((booking) => {
        const date = new Intl.DateTimeFormat(getKlyxTrustIntlLocale(locale), {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(`${booking.booking_date}T00:00:00`));
        return {
          value: booking.id,
          label: `${date} ${t("at")} ${booking.start_time.slice(0, 5)} · ${translateKlyxTrustStatus(locale, booking.status)}`,
        };
      }),
    [bookings, locale]
  );

  const reasonOptions = useMemo(
    () =>
      REASON_VALUES.map((value) => ({
        value,
        label: translateKlyxTrustReason(locale, value),
      })),
    [locale]
  );

  useEffect(() => {
    async function loadBookings() {
      try {
        const profile = await getActiveClientProfile();
        const { data, error } = await supabase
          .from("bookings")
          .select("id, booking_date, start_time, status")
          .or(
            `parent_id.eq.${profile.id},provider_id.eq.${profile.id},babysitter_id.eq.${profile.id}`
          )
          .neq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) {
          setErrorMessage(t("loadError"));
          return;
        }
        setBookings((data ?? []) as Booking[]);
      } catch {
        setErrorMessage(t("loadError"));
      } finally {
        setLoading(false);
      }
    }

    void loadBookings();
  }, [locale]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting || !bookingId || !reason || description.trim().length < 20) return;

    setSubmitting(true);
    setErrorMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.replace("/login");
        return;
      }

      const response = await fetch("/api/disputes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          bookingId,
          reason,
          description,
        }),
      });

      await response.json();
      if (!response.ok) {
        setErrorMessage(t("submitError"));
        return;
      }

      router.push("/trust?created=1");
      router.refresh();
    } catch {
      setErrorMessage(t("submitError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-3xl">
        <Link href="/trust" className="inline-flex items-center gap-2 text-sm font-black text-muted-foreground">
          <ArrowLeft size={17} />
          {t("back")}
        </Link>

        <section className="klyx-card mt-6 p-6 sm:p-8">
          <div className="flex gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-500/10 text-rose-600">
              <ShieldAlert size={24} />
            </div>
            <div>
              <p className="klyx-eyebrow">{t("eyebrow")}</p>
              <h1 className="mt-2 text-3xl font-black">{t("title")}</h1>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{t("description")}</p>
            </div>
          </div>

          {errorMessage && (
            <div className="mt-6 flex gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
              <AlertTriangle size={18} />
              {errorMessage}
            </div>
          )}

          {loading ? (
            <div className="mt-8 grid min-h-40 place-items-center">
              <LoaderCircle className="animate-spin text-violet-600" size={34} />
            </div>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-black">{t("bookingLabel")}</span>
                <KlyxSelect
                  value={bookingId}
                  onChange={setBookingId}
                  placeholder={t("bookingPlaceholder")}
                  options={bookingOptions}
                  ariaLabel={t("bookingAria")}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-black">{t("reasonLabel")}</span>
                <KlyxSelect
                  value={reason}
                  onChange={setReason}
                  placeholder={t("reasonPlaceholder")}
                  options={reasonOptions}
                  ariaLabel={t("reasonAria")}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-black">{t("descriptionLabel")}</span>
                <textarea
                  required
                  minLength={20}
                  maxLength={2000}
                  rows={8}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="klyx-input resize-none"
                  placeholder={t("descriptionPlaceholder")}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  {description.length}/2000 {t("characters")}
                </p>
              </label>

              <button
                type="submit"
                disabled={submitting || !bookingId || !reason || description.trim().length < 20}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 px-5 text-sm font-black text-white disabled:opacity-40"
              >
                {submitting && <LoaderCircle className="animate-spin" size={18} />}
                {t("submit")}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
