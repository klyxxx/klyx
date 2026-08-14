"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  Eye,
  History,
  LoaderCircle,
  PhoneCall,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

// KLYX_PHONE_ACCESS_HISTORY_UI_12_76

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

const SERVICE_LABELS: Record<string, string> = {
  babysitting: "Baby-sitting",
  cleaning: "Menage",
  moving: "Demenagement",
  handyman: "Bricolage",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(
    "fr-BE",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(new Date(value));
}

function serviceLabel(
  slug: string | null
) {
  if (!slug) {
    return "Mission KLYX";
  }

  return SERVICE_LABELS[slug] ?? slug;
}

export default function PhoneAccessHistory() {
  const [items, setItems] =
    useState<AccessItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const loadHistory =
    useCallback(async (refresh = false) => {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setErrorMessage("");

      try {
        const { data } =
          await supabase.auth.getSession();

        const token =
          data.session?.access_token;

        if (!token) {
          throw new Error(
            "Session KLYX introuvable."
          );
        }

        const response = await fetch(
          "/api/profile/phone/access-history",
          {
            cache: "no-store",
            headers: {
              Authorization:
                "Bearer " + token,
            },
          }
        );

        const result =
          (await response.json()) as HistoryPayload;

        if (!response.ok) {
          throw new Error(
            result.error ||
              "Historique indisponible."
          );
        }

        setItems(result.items ?? []);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Historique indisponible."
        );
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
            <h2 className="text-xl font-black">
              Historique de confidentialite
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Consulte les derniers acces autorises a ton numero de telephone KLYX.
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={refreshing}
          onClick={() =>
            void loadHistory(true)
          }
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-black transition hover:bg-muted disabled:opacity-60"
        >
          <RefreshCw
            size={16}
            className={
              refreshing
                ? "animate-spin"
                : ""
            }
          />
          Actualiser
        </button>
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-2xl bg-emerald-500/[0.07] px-4 py-3">
        <ShieldCheck
          size={18}
          className="mt-0.5 shrink-0 text-emerald-500"
        />

        <p className="text-xs leading-5 text-muted-foreground">
          Cet historique affiche les acces de securite uniquement. Aucun numero de telephone ni code SMS OTP n y apparait.
        </p>
      </div>

      {loading ? (
        <div className="mt-6 flex items-center gap-3 text-sm font-bold text-muted-foreground">
          <LoaderCircle
            size={18}
            className="animate-spin"
          />
          Chargement de l historique...
        </div>
      ) : errorMessage ? (
        <div className="mt-6 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-500">
          {errorMessage}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-background/50 p-6 text-center">
          <ShieldCheck
            size={28}
            className="mx-auto text-emerald-500"
          />

          <p className="mt-3 font-black">
            Aucun acces enregistre
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            Personne n a encore revele ton numero via KLYX.
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
                {item.eventType ===
                "phone_call_started" ? (
                  <PhoneCall size={18} />
                ) : (
                  <Eye size={18} />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-black">
                    {item.viewerName}
                  </p>

                  <span className="text-xs font-semibold text-muted-foreground">
                    {formatDate(
                      item.createdAt
                    )}
                  </span>
                </div>

                <p className="mt-1 text-sm font-semibold">
                  {item.eventLabel}
                </p>

                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-muted px-2.5 py-1">
                    {serviceLabel(
                      item.serviceSlug
                    )}
                  </span>

                  {item.bookingStatus && (
                    <span className="rounded-full bg-muted px-2.5 py-1">
                      {item.bookingStatus}
                    </span>
                  )}

                  <span className="rounded-full bg-muted px-2.5 py-1">
                    Mission{" "}
                    {item.bookingId.slice(
                      0,
                      8
                    )}
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