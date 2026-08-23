"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Eye,
  History,
  LoaderCircle,
  PhoneCall,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  formatKlyxPhoneHistoryDate,
  translateKlyxPhoneHistory,
  translateKlyxPhoneHistoryEvent,
  translateKlyxPhoneHistoryService,
  translateKlyxPhoneHistoryStatus,
  translateKlyxPhoneHistoryViewer,
  type KlyxPhoneHistoryMessageKey,
} from "@/lib/klyx-phone-history-i18n";
import { supabase } from "@/lib/supabase";

// KLYX_PHONE_ACCESS_HISTORY_UI_12_76
// KLYX_PHONE_ACCESS_HISTORY_I18N_16_08

type AccessItem = {
  id: string;
  bookingId: string;
  viewerName: string;
  eventType: string;
  eventLabel: string;
  createdAt: string;
  bookingStatus: string | null;
  serviceSlug: string | null;
};

type HistoryPayload = {
  items?: AccessItem[];
  total?: number;
  error?: string;
};

export default function PhoneAccessHistory() {
  const { locale } = useKlyxLocale();
  const t = (
    key: KlyxPhoneHistoryMessageKey,
    variables?: Readonly<Record<string, string | number>>
  ) => translateKlyxPhoneHistory(locale, key, variables);

  const [items, setItems] = useState<AccessItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorKey, setErrorKey] =
    useState<KlyxPhoneHistoryMessageKey | null>(null);

  const loadHistory = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setErrorKey(null);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        setErrorKey("sessionMissing");
        return;
      }

      const response = await fetch("/api/profile/phone/access-history", {
        cache: "no-store",
        headers: { Authorization: "Bearer " + token },
      });
      const result = (await response.json()) as HistoryPayload;

      if (!response.ok) {
        setErrorKey("loadFailed");
        return;
      }

      setItems(result.items ?? []);
    } catch {
      setErrorKey("loadFailed");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  return (
    <section className="mb-7 rounded-[30px] border border-border bg-card p-6 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-500/10 text-violet-500">
            <History size={22} />
          </div>
          <div>
            <h2 className="text-xl font-black">{t("title")}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {t("description")}
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={refreshing}
          onClick={() => void loadHistory(true)}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-black transition hover:bg-muted disabled:opacity-60"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          {t("refresh")}
        </button>
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-2xl bg-emerald-500/[0.07] px-4 py-3">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-500" />
        <p className="text-xs leading-5 text-muted-foreground">
          {t("privacyNote")}
        </p>
      </div>

      {loading ? (
        <div className="mt-6 flex items-center gap-3 text-sm font-bold text-muted-foreground">
          <LoaderCircle size={18} className="animate-spin" />
          {t("loading")}
        </div>
      ) : errorKey ? (
        <div className="mt-6 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-500">
          {t(errorKey)}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-background/50 p-6 text-center">
          <ShieldCheck size={28} className="mx-auto text-emerald-500" />
          <p className="mt-3 font-black">{t("noAccessTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("noAccessDescription")}
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex min-w-0 items-start gap-4 rounded-2xl border border-border bg-background/60 p-4 sm:p-5"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-500">
                {item.eventType === "phone_call_started" ? (
                  <PhoneCall size={18} />
                ) : (
                  <Eye size={18} />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-black">
                    {translateKlyxPhoneHistoryViewer(locale, item.viewerName)}
                  </p>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {formatKlyxPhoneHistoryDate(locale, item.createdAt)}
                  </span>
                </div>

                <p className="mt-1 text-sm font-semibold">
                  {translateKlyxPhoneHistoryEvent(locale, item.eventType)}
                </p>

                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-muted px-2.5 py-1">
                    {translateKlyxPhoneHistoryService(locale, item.serviceSlug)}
                  </span>

                  {item.bookingStatus && (
                    <span className="rounded-full bg-muted px-2.5 py-1">
                      {translateKlyxPhoneHistoryStatus(locale, item.bookingStatus)}
                    </span>
                  )}

                  <span className="rounded-full bg-muted px-2.5 py-1">
                    {t("missionId", { id: item.bookingId.slice(0, 8) })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
