"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Euro,
  LoaderCircle,
  MapPin,
  Navigation,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import {
  useParams,
  useRouter,
} from "next/navigation";

import { supabase } from "@/lib/supabase";

import GroupCancellationCard from "./GroupCancellationCard";
// KLYX_GROUP_MISSION_PAGE_12_87

type BookingItem = {
  id: string;
  group_position: number;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string;
  service_status: string;
  amount_total: number | null;
  currency: string | null;
};

type GroupResponse = {
  group: {
    id: string;
    status: string;
    payment_status: string;
    totalAmountCents: number;
    currency: string;
    slot_count: number;
    clientName: string;
    providerName: string;
  };

  request: {
    id: string;
    title: string;
    city: string;
    serviceName: string;
    status: string;
  };

  bookings:
    BookingItem[];

  role:
    | "client"
    | "provider";

  paymentActionAvailable:
    boolean;

  automaticPayment:
    false;
};

async function accessToken() {
  const {
    data: {
      session,
    },
  } =
    await supabase.auth.getSession();

  if (
    !session?.access_token
  ) {
    throw new Error(
      "Session manquante."
    );
  }

  return session.access_token;
}

function statusLabel(
  value: string
) {
  if (
    value ===
    "pending_provider"
  ) {
    return "En attente du prestataire";
  }

  if (
    value ===
    "accepted"
  ) {
    return "Mission confirmee";
  }

  if (
    value ===
    "rejected"
  ) {
    return "Groupe refuse";
  }

  if (
    value ===
    "completed"
  ) {
    return "Mission groupee terminee";
  }

  return value;
}

function paymentLabel(
  value: string
) {
  if (
    value === "paid"
  ) {
    return "Paye";
  }

  if (
    value ===
    "processing"
  ) {
    return "Paiement en cours";
  }

  if (
    value ===
    "failed"
  ) {
    return "Paiement a reprendre";
  }

  return "Non paye";
}

function missionLabel(
  booking: BookingItem
) {
  if (
    booking.status ===
      "completed" ||
    booking.service_status ===
      "completed"
  ) {
    return "Termine";
  }

  if (
    booking.service_status ===
    "en_route"
  ) {
    return "Prestataire en route";
  }

  if (
    booking.service_status ===
    "arrived"
  ) {
    return "Prestataire arrive";
  }

  if (
    booking.service_status ===
    "in_progress"
  ) {
    return "En cours";
  }

  if (
    booking.status ===
    "accepted"
  ) {
    return "Planifie";
  }

  return booking.status;
}

function isCompleted(
  booking: BookingItem
) {
  return (
    booking.status ===
      "completed" ||
    booking.service_status ===
      "completed"
  );
}

function isActive(
  booking: BookingItem
) {
  return [
    "en_route",
    "arrived",
    "in_progress",
  ].includes(
    booking.service_status
  );
}

export default function BookingGroupPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const router =
    useRouter();

  const [
    data,
    setData,
  ] =
    useState<GroupResponse | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    paying,
    setPaying,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const load =
    useCallback(
      async () => {
        setLoading(true);
        setErrorMessage("");

        try {
          const token =
            await accessToken();

          const response =
            await fetch(
              "/api/booking-groups/" +
                params.id,
              {
                cache:
                  "no-store",

                headers: {
                  Authorization:
                    "Bearer " +
                    token,
                },
              }
            );

          const result =
            (await response.json()) as
              | GroupResponse
              | {
                  error?: string;
                };

          if (!response.ok) {
            throw new Error(
              "error" in result
                ? result.error ||
                    "Groupe indisponible."
                : "Groupe indisponible."
            );
          }

          setData(
            result as GroupResponse
          );
        } catch (error) {
          if (
            error instanceof Error &&
            error.message ===
              "Session manquante."
          ) {
            router.replace(
              "/login"
            );

            return;
          }

          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Groupe indisponible."
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [
        params.id,
        router,
      ]
    );

  useEffect(() => {
    void load();
  }, [load]);

  const progress =
    useMemo(
      () => {
        const bookings =
          data?.bookings ??
          [];

        const total =
          bookings.length;

        const completed =
          bookings.filter(
            isCompleted
          ).length;

        const active =
          bookings.filter(
            isActive
          ).length;

        const percent =
          total > 0
            ? Math.round(
                completed /
                  total *
                  100
              )
            : 0;

        return {
          total,
          completed,
          active,
          percent,
          allCompleted:
            total > 0 &&
            completed ===
              total,
        };
      },
      [data]
    );

  async function decide(
    action:
      | "accept"
      | "reject"
  ) {
    if (busy) {
      return;
    }

    setBusy(true);
    setErrorMessage("");

    try {
      const token =
        await accessToken();

      const response =
        await fetch(
          "/api/booking-groups/" +
            params.id,
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                "Bearer " +
                token,
            },

            body:
              JSON.stringify({
                action,
              }),
          }
        );

      const result =
        (await response.json()) as {
          status?: string;
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Action impossible."
        );
      }

      await load();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Action impossible."
      );
    } finally {
      setBusy(
        false
      );
    }
  }

  async function payGroup() {
    if (
      paying ||
      !data
    ) {
      return;
    }

    setPaying(true);
    setErrorMessage("");

    try {
      const token =
        await accessToken();

      const response =
        await fetch(
          "/api/stripe/create-group-checkout-session",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                "Bearer " +
                token,
            },

            body:
              JSON.stringify({
                groupId:
                  data.group.id,
              }),
          }
        );

      const result =
        (await response.json()) as {
          url?: string;
          error?: string;
          alreadyPaid?: boolean;
        };

      if (
        result.alreadyPaid
      ) {
        await load();
        return;
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Paiement groupe impossible."
        );
      }

      if (!result.url) {
        throw new Error(
          "Lien Stripe manquant."
        );
      }

      window.location.assign(
        result.url
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Paiement groupe impossible."
      );

      setPaying(
        false
      );
    }
  }

  if (loading) {
    return (
      <main className="klyx-page grid min-h-[70vh] place-items-center">
        <LoaderCircle
          className="animate-spin text-violet-600"
          size={38}
        />
      </main>
    );
  }

  if (
    errorMessage &&
    !data
  ) {
    return (
      <main className="klyx-page">
        <div className="mx-auto max-w-4xl rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6 text-rose-700 dark:text-rose-300">
          {errorMessage}
        </div>
      </main>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/requests"
          className="text-sm font-black text-muted-foreground hover:text-foreground"
        >
          Retour aux demandes
        </Link>

        <section className="mt-6 rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#17131f,#4c1d95_52%,#111827)] p-7 text-white sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-white/70">
            <Sparkles
              size={14}
            />
            Mission groupee KLYX
          </div>

          <h1 className="mt-5 text-3xl font-black sm:text-5xl">
            {data.request.title}
          </h1>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/70">
            <span>
              {data.request.serviceName}
            </span>

            <span className="inline-flex items-center gap-1.5">
              <MapPin
                size={15}
              />

              {data.request.city}
            </span>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black">
              {data.group.slot_count}
              {" creneaux"}
            </span>

            <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black">
              {statusLabel(
                data.group.status
              )}
            </span>

            <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black">
              {paymentLabel(
                data.group
                  .payment_status
              )}
            </span>
          </div>
        </section>

        {data.group
          .payment_status ===
          "paid" && (
          <section className="klyx-card mt-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="klyx-eyebrow">
                  Progression de la mission
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  {
                    progress.completed
                  }
                  /
                  {progress.total}
                  {" creneaux termines"}
                </h2>
              </div>

              <p className="text-3xl font-black text-violet-600">
                {
                  progress.percent
                }
                %
              </p>
            </div>

            <div className="mt-5 h-3 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-violet-600 transition-all"
                style={{
                  width:
                    String(
                      progress.percent
                    ) + "%",
                }}
              />
            </div>

            {progress.active >
              0 && (
              <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1.5 text-xs font-black text-violet-700 dark:text-violet-300">
                <Navigation
                  size={14}
                />

                {progress.active}
                {" creneau actif"}
              </p>
            )}
          </section>
        )}

        {errorMessage && (
          <div className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
            {errorMessage}
          </div>
        )}

        <section className="mt-6 grid gap-4">
          {data.bookings.map(
            (booking) => {
              const trackable =
                data.group
                  .payment_status ===
                  "paid" &&
                [
                  "accepted",
                  "completed",
                ].includes(
                  booking.status
                );

              return (
                <article
                  key={
                    booking.id
                  }
                  className="klyx-card p-5 sm:p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="klyx-eyebrow">
                        Creneau{" "}
                        {
                          booking.group_position
                        }
                      </p>

                      <h2 className="mt-2 text-xl font-black">
                        {
                          booking.booking_date
                        }
                      </h2>
                    </div>

                    <span
                      className={
                        isCompleted(
                          booking
                        )
                          ? "rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-700 dark:text-emerald-300"
                          : isActive(
                                booking
                              )
                            ? "rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-black text-violet-700 dark:text-violet-300"
                            : "rounded-full bg-muted px-3 py-1 text-xs font-black"
                      }
                    >
                      {missionLabel(
                        booking
                      )}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <Info
                      icon={
                        <CalendarDays
                          size={17}
                        />
                      }
                      label="Date"
                      value={
                        booking.booking_date
                      }
                    />

                    <Info
                      icon={
                        <Clock3
                          size={17}
                        />
                      }
                      label="Horaire"
                      value={
                        booking.start_time +
                        " - " +
                        booking.end_time
                      }
                    />

                    <Info
                      icon={
                        <Euro
                          size={17}
                        />
                      }
                      label="Part du prix"
                      value={
                        (
                          (
                            booking.amount_total ??
                            0
                          ) /
                          100
                        ).toFixed(
                          2
                        ) +
                        " EUR"
                      }
                    />
                  </div>

                  {trackable && (
                    <Link
                      href={
                        "/tracking/" +
                        booking.id
                      }
                      className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 text-sm font-black text-violet-700 transition hover:bg-violet-500/15 dark:text-violet-300"
                    >
                      <Navigation
                        size={17}
                      />

                      {isCompleted(
                        booking
                      )
                        ? "Voir le suivi"
                        : "Suivre ce creneau"}

                      <ArrowRight
                        size={16}
                      />
                    </Link>
                  )}
                </article>
              );
            }
          )}
        </section>

        <section className="klyx-card mt-6 p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="klyx-eyebrow">
                Total du groupe
              </p>

              <p className="mt-2 text-3xl font-black text-violet-600">
                {(
                  data.group
                    .totalAmountCents /
                  100
                ).toFixed(
                  2
                )}
                {" EUR"}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm">
              <p className="font-black">
                Prestataire
              </p>

              <p className="mt-1 text-muted-foreground">
                {
                  data.group
                    .providerName
                }
              </p>
            </div>
          </div>

          {data.role ===
            "provider" &&
            data.group.status ===
              "pending_provider" && (
              <div className="mt-6 rounded-3xl border border-violet-500/20 bg-violet-500/5 p-5">
                <div className="flex gap-3">
                  <ShieldCheck
                    className="mt-0.5 shrink-0 text-violet-600"
                    size={20}
                  />

                  <div>
                    <p className="font-black">
                      Confirme tous les creneaux ensemble
                    </p>

                    <p className="mt-2 text-sm text-muted-foreground">
                      KLYX reverifie ton planning avant l acceptation.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={
                      busy
                    }
                    onClick={() =>
                      void decide(
                        "reject"
                      )
                    }
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-background text-sm font-black disabled:opacity-50"
                  >
                    <XCircle
                      size={18}
                    />
                    Refuser le groupe
                  </button>

                  <button
                    type="button"
                    disabled={
                      busy
                    }
                    onClick={() =>
                      void decide(
                        "accept"
                      )
                    }
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-violet-600 text-sm font-black text-white disabled:opacity-50"
                  >
                    {busy ? (
                      <LoaderCircle
                        className="animate-spin"
                        size={18}
                      />
                    ) : (
                      <CheckCircle2
                        size={18}
                      />
                    )}

                    Accepter tous les creneaux
                  </button>
                </div>
              </div>
            )}

          {data.role ===
            "client" &&
            data.group.status ===
              "pending_provider" && (
              <div className="mt-6 rounded-3xl border border-amber-500/20 bg-amber-500/10 p-5">
                <p className="font-black text-amber-800 dark:text-amber-200">
                  En attente du prestataire
                </p>

                <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                  Le prestataire doit confirmer tous les creneaux.
                </p>
              </div>
            )}

          {data.role ===
            "client" &&
            data.group.status ===
              "accepted" &&
            data.group
              .payment_status !==
              "paid" && (
              <div className="mt-6 rounded-3xl border border-violet-500/20 bg-violet-500/5 p-5">
                <div className="flex gap-3">
                  <CreditCard
                    className="mt-0.5 shrink-0 text-violet-600"
                    size={20}
                  />

                  <div>
                    <p className="font-black">
                      Un seul paiement pour tout le groupe
                    </p>

                    <p className="mt-2 text-sm text-muted-foreground">
                      Stripe debitera le montant total une seule fois.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={
                    paying
                  }
                  onClick={() =>
                    void payGroup()
                  }
                  className="mt-5 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 text-sm font-black text-white disabled:opacity-50"
                >
                  {paying ? (
                    <LoaderCircle
                      className="animate-spin"
                      size={19}
                    />
                  ) : (
                    <CreditCard
                      size={19}
                    />
                  )}

                  Payer{" "}
                  {(
                    data.group
                      .totalAmountCents /
                    100
                  ).toFixed(
                    2
                  )}
                  {" EUR"}
                </button>

                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Aucun paiement sans ton clic.
                </p>
              </div>
            )}

          {/* KLYX_GROUP_CANCELLATION_CARD_12_89 */}
          <GroupCancellationCard
            groupId={data.group.id}
            groupStatus={data.group.status}
            paymentStatus={data.group.payment_status}
            role={data.role}
          />
          {/* KLYX_GROUP_REVIEW_CTA_12_88 */}
          {progress.allCompleted && (
            <div className="mt-6 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5">
              <div className="flex gap-3">
                <CheckCircle2
                  className="mt-0.5 shrink-0 text-emerald-600"
                  size={22}
                />

                <div>
                  <p className="font-black text-emerald-800 dark:text-emerald-200">
                    Mission groupee terminee
                  </p>

                  <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
                    Tous les creneaux ont ete termines et confirmes.
                  </p>
                </div>
              </div>

              {data.role === "client" &&
                data.group.payment_status === "paid" && (
                  <Link
                    href={
                      "/reviews/group/" +
                      data.group.id
                    }
                    className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white transition hover:bg-emerald-500"
                  >
                    Donner un avis sur la mission complete
                    <ArrowRight size={17} />
                  </Link>
                )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Info({
  icon,
  label,
  value,
}: {
  icon:
    React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
        {icon}
        {label}
      </div>

      <p className="mt-2 font-black">
        {value}
      </p>
    </div>
  );
}