"use client";

import {
  FormEvent,
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Euro,
  MapPin,
  Search,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  isPastBookingStart,
  minimumFutureTimeForDate,
  todayInBrussels,
} from "@/lib/brussels-time";
import {
  formatKlyxRequestConfirmService,
  translateKlyxRequestConfirm,
  type KlyxRequestConfirmMessageKey,
} from "@/lib/klyx-request-confirm-i18n";

// KLYX_REQUEST_CONFIRM_I18N
// KLYX_REQUEST_CONFIRM_NAVIGATION_ONLY

type ConfirmedRequest = {
  service: string;
  city: string;
  date: string;
  time: string;
  budget: string;
};

type ConfirmErrorKey =
  | "pastInterpretedDate"
  | "pastDate"
  | "pastTodayTime";

function ConfirmRequestContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useKlyxLocale();
  const t = (key: KlyxRequestConfirmMessageKey) =>
    translateKlyxRequestConfirm(locale, key);
  const minimumDate = todayInBrussels();

  // KLYX_CONFIRMATION_PROOF_12_64
  const conversationId =
    searchParams.get("conversationId")?.trim() ?? "";
  const confirmationId =
    searchParams.get("confirmationId")?.trim() ?? "";

  const initialRequest = useMemo<ConfirmedRequest>(
    () => ({
      service: searchParams.get("service")?.trim() ?? "",
      city: searchParams.get("city")?.trim() ?? "",
      date: searchParams.get("date")?.trim() ?? "",
      time: searchParams.get("time")?.trim() ?? "",
      budget: searchParams.get("budget")?.trim() ?? "",
    }),
    [searchParams]
  );

  const [request, setRequest] = useState(initialRequest);
  const [errorKey, setErrorKey] = useState<ConfirmErrorKey | null>(null);

  useEffect(() => {
    if (request.date && request.date < minimumDate) {
      setRequest((current) => ({
        ...current,
        date: "",
        time: "",
      }));
      setErrorKey("pastInterpretedDate");
    }
  }, [minimumDate, request.date]);

  function update<Key extends keyof ConfirmedRequest>(
    key: Key,
    value: ConfirmedRequest[Key]
  ) {
    setErrorKey(null);

    setRequest((current) => {
      if (key === "date") {
        return {
          ...current,
          date: value,
          time:
            value === minimumDate &&
            current.time &&
            isPastBookingStart(value, current.time)
              ? ""
              : current.time,
        };
      }

      return { ...current, [key]: value };
    });
  }

  function continueToSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorKey(null);

    if (request.date < minimumDate) {
      setErrorKey("pastDate");
      return;
    }

    if (isPastBookingStart(request.date, request.time)) {
      setErrorKey("pastTodayTime");
      return;
    }

    const params = new URLSearchParams();

    params.set("service", request.service);
    params.set("city", request.city.trim());
    params.set("date", request.date);
    params.set("time", request.time);

    if (request.budget && Number(request.budget) >= 0) {
      params.set("budget", request.budget);
    }

    if (conversationId) {
      params.set("conversationId", conversationId);
    }

    if (confirmationId) {
      params.set("confirmationId", confirmationId);
    }

    router.push(`/recommendations?${params.toString()}`);
  }

  const serviceLabel = formatKlyxRequestConfirmService(locale, request.service);
  const minimumTime = minimumFutureTimeForDate(request.date);

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/brain"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft size={17} />
          {t("backToAssistant")}
        </Link>

        <section className="mt-8 max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
            {t("eyebrow")}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-[-0.045em] sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
            {t("description")}
          </p>
        </section>

        <form
          onSubmit={continueToSearch}
          className="klyx-card mt-8 p-6 sm:p-8"
        >
          <div className="mb-7 flex items-start gap-3 rounded-2xl border border-blue-500/15 bg-blue-500/[0.04] p-4">
            <CheckCircle2
              size={19}
              className="mt-0.5 shrink-0 text-blue-600"
            />
            <div>
              <p className="font-bold">{t("noPaymentTitle")}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {t("noPaymentText")}
              </p>
            </div>
          </div>

          {errorKey && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
              <AlertCircle className="mt-0.5 shrink-0" size={19} />
              {t(errorKey)}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Field
              icon={<Search size={18} />}
              label={t("service")}
              summary={serviceLabel}
            >
              <input
                value={request.service}
                onChange={(event) => update("service", event.target.value)}
                className="klyx-input"
                placeholder={t("servicePlaceholder")}
                required
              />
            </Field>

            <Field
              icon={<MapPin size={18} />}
              label={t("city")}
              summary={request.city || t("toSpecify")}
            >
              <input
                value={request.city}
                onChange={(event) => update("city", event.target.value)}
                className="klyx-input"
                placeholder={t("cityPlaceholder")}
                required
              />
            </Field>

            <Field
              icon={<CalendarDays size={18} />}
              label={t("date")}
              summary={request.date || t("toSpecify")}
            >
              <input
                type="date"
                min={minimumDate}
                value={request.date}
                onChange={(event) => update("date", event.target.value)}
                className="klyx-input"
                required
              />
            </Field>

            <Field
              icon={<Clock3 size={18} />}
              label={t("time")}
              summary={request.time || t("toSpecify")}
            >
              <input
                type="time"
                min={minimumTime}
                value={request.time}
                onChange={(event) => update("time", event.target.value)}
                className="klyx-input"
                required
              />
            </Field>

            <Field
              icon={<Euro size={18} />}
              label={t("budget")}
              summary={request.budget ? `${request.budget} €` : t("noMaximum")}
            >
              <input
                type="number"
                min="0"
                step="0.01"
                value={request.budget}
                onChange={(event) => update("budget", event.target.value)}
                className="klyx-input"
                placeholder={t("optional")}
              />
            </Field>
          </div>

          <button
            type="submit"
            className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            {t("continue")}
            <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </main>
  );
}

function Field({
  icon,
  label,
  summary,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-5">
      <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
        {icon}
        <span className="text-xs font-bold uppercase tracking-[0.15em]">
          {label}
        </span>
      </div>
      <p className="mt-2 text-base font-bold">{summary}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export default function ConfirmRequestPage() {
  const { locale } = useKlyxLocale();

  return (
    <Suspense
      fallback={
        <main className="klyx-page">
          <div className="mx-auto max-w-5xl rounded-3xl border border-border bg-card p-8 text-center text-muted-foreground">
            {translateKlyxRequestConfirm(locale, "loading")}
          </div>
        </main>
      }
    >
      <ConfirmRequestContent />
    </Suspense>
  );
}
