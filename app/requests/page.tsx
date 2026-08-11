"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Clock3,
  Euro,
  LoaderCircle,
  MapPin,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import KlyxSelect from "@/app/components/KlyxSelect";

type ServiceOption = {
  value: string;
  label: string;
};

type Offer = {
  id: string;
  amount: number;
  message: string | null;
  status: string;
  provider: {
    first_name: string | null;
    last_name: string | null;
  } | null;
};

type MarketRequest = {
  id: string;
  title: string;
  description: string;
  city: string;
  requested_date: string | null;
  requested_time: string | null;
  budget_max: number | null;
  status: string;
  service: {
    name: string;
    slug: string;
  } | null;
  bookingQuote: {
    id: string;
    status: string;
  } | null;
  offers: Offer[];
};

async function token() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Session manquante.");
  }

  return session.access_token;
}

function providerName(offer: Offer) {
  const name = [
    offer.provider?.first_name,
    offer.provider?.last_name,
  ]
    .filter(Boolean)
    .join(" ");

  return name || "Prestataire KLYX";
}

export default function RequestsPage() {
  const [services, setServices] =
    useState<ServiceOption[]>([]);
  const [serviceSlug, setServiceSlug] =
    useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] =
    useState("");
  const [city, setCity] = useState("");
  const [requestedDate, setRequestedDate] =
    useState("");
  const [requestedTime, setRequestedTime] =
    useState("");
  const [budgetMax, setBudgetMax] =
    useState("");
  const [requests, setRequests] =
    useState<MarketRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] =
    useState("");

  async function load() {
    setLoading(true);
    setErrorMessage("");

    try {
      const accessToken = await token();

      const [
        requestResponse,
        serviceResponse,
      ] = await Promise.all([
        fetch("/api/market/requests", {
          cache: "no-store",
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },
        }),
        fetch("/api/services/public", {
          cache: "no-store",
        }),
      ]);

      const requestBody =
        await requestResponse.json();
      const serviceBody =
        await serviceResponse.json();

      if (!requestResponse.ok) {
        throw new Error(
          requestBody.error ||
            "Chargement impossible."
        );
      }

      setRequests(requestBody.requests ?? []);

      const options =
        Array.isArray(serviceBody.services)
          ? serviceBody.services.filter(
              (item: ServiceOption) =>
                item.value !== "all"
            )
          : [];

      setServices(options);

      if (!serviceSlug && options[0]) {
        setServiceSlug(options[0].value);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Chargement impossible."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function publish(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setBusy("publish");
    setMessage("");
    setErrorMessage("");

    try {
      const accessToken = await token();

      const response = await fetch(
        "/api/market/requests",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            serviceSlug,
            title,
            description,
            city,
            requestedDate:
              requestedDate || null,
            requestedTime:
              requestedTime || null,
            budgetMax:
              budgetMax === ""
                ? null
                : Number(budgetMax),
          }),
        }
      );

      const body = await response.json();

      if (!response.ok) {
        throw new Error(
          body.error ||
            "Publication impossible."
        );
      }

      setTitle("");
      setDescription("");
      setRequestedDate("");
      setRequestedTime("");
      setBudgetMax("");
      setMessage(
        body.message || "Demande publiée."
      );

      await load();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Publication impossible."
      );
    } finally {
      setBusy("");
    }
  }

  async function requestAction(
    requestId: string,
    action: "cancel"
  ) {
    setBusy(requestId);
    setMessage("");
    setErrorMessage("");

    try {
      const accessToken = await token();

      const response = await fetch(
        "/api/market/requests",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            requestId,
            action,
          }),
        }
      );

      const body = await response.json();

      if (!response.ok) {
        throw new Error(
          body.error || "Action impossible."
        );
      }

      setMessage(
        body.message ||
          "Demande mise à jour."
      );

      await load();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Action impossible."
      );
    } finally {
      setBusy("");
    }
  }

  async function offerAction(
    requestId: string,
    offerId: string,
    action: "accept" | "reject"
  ) {
    setBusy(offerId);
    setMessage("");
    setErrorMessage("");

    try {
      const accessToken = await token();

      const response = await fetch(
        `/api/market/requests/${requestId}/offers`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            offerId,
            action,
          }),
        }
      );

      const body = (await response.json()) as {
        message?: string;
        error?: string;
        quoteId?: string;
        bookingHref?: string;
      };

      if (!response.ok) {
        throw new Error(
          body.error || "Action impossible."
        );
      }

      setMessage(
        body.message || "Offre mise à jour."
      );

      await load();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Action impossible."
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#17131f,#4c1d95_52%,#111827)] p-7 text-white sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-white/65">
            Marché KLYX
          </p>
          <h1 className="mt-3 text-3xl font-black sm:text-5xl">
            Publie ton besoin, compare les offres
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
            Pour les besoins où tu préfères
            recevoir plusieurs propositions avant
            de choisir.
          </p>
        </section>

        <form
          onSubmit={publish}
          className="klyx-card mt-7 p-6 sm:p-8"
        >
          <h2 className="text-2xl font-black">
            Nouvelle demande ouverte
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label>
              <span className="mb-2 block text-sm font-black">
                Service
              </span>
              <KlyxSelect
                value={serviceSlug}
                onChange={setServiceSlug}
                options={services}
                ariaLabel="Service"
              />
            </label>

            <label>
              <span className="mb-2 block text-sm font-black">
                Ville
              </span>
              <input
                className="klyx-input"
                value={city}
                onChange={(event) =>
                  setCity(event.target.value)
                }
                required
              />
            </label>

            <label className="sm:col-span-2">
              <span className="mb-2 block text-sm font-black">
                Titre
              </span>
              <input
                className="klyx-input"
                value={title}
                onChange={(event) =>
                  setTitle(event.target.value)
                }
                maxLength={120}
                required
              />
            </label>

            <label className="sm:col-span-2">
              <span className="mb-2 block text-sm font-black">
                Description
              </span>
              <textarea
                className="klyx-input min-h-36 resize-y p-4"
                value={description}
                onChange={(event) =>
                  setDescription(
                    event.target.value
                  )
                }
                maxLength={2000}
                required
              />
            </label>

            <label>
              <span className="mb-2 flex items-center gap-2 text-sm font-black">
                <Clock3 size={16} />
                Date
              </span>
              <input
                type="date"
                className="klyx-input"
                value={requestedDate}
                onChange={(event) =>
                  setRequestedDate(
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              <span className="mb-2 flex items-center gap-2 text-sm font-black">
                <Clock3 size={16} />
                Heure
              </span>
              <input
                type="time"
                className="klyx-input"
                value={requestedTime}
                onChange={(event) =>
                  setRequestedTime(
                    event.target.value
                  )
                }
              />
            </label>

            <label className="sm:col-span-2">
              <span className="mb-2 flex items-center gap-2 text-sm font-black">
                <Euro size={16} />
                Budget maximum
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                className="klyx-input"
                value={budgetMax}
                onChange={(event) =>
                  setBudgetMax(
                    event.target.value
                  )
                }
              />
            </label>
          </div>

          <button
            disabled={busy === "publish"}
            className="klyx-button mt-5 w-full"
          >
            {busy === "publish" ? (
              <LoaderCircle
                className="animate-spin"
                size={18}
              />
            ) : (
              <Send size={18} />
            )}
            Publier la demande
          </button>
        </form>

        {message && (
          <div className="mt-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
            {message}
          </div>
        )}

        {errorMessage && (
          <div className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
            {errorMessage}
          </div>
        )}

        <section className="mt-8">
          <h2 className="text-2xl font-black">
            Mes demandes
          </h2>

          {loading ? (
            <div className="mt-5 grid min-h-40 place-items-center">
              <LoaderCircle className="animate-spin text-violet-600" />
            </div>
          ) : requests.length === 0 ? (
            <div className="klyx-card mt-5 p-6 text-muted-foreground">
              Aucune demande ouverte pour le
              moment.
            </div>
          ) : (
            <div className="mt-5 grid gap-5">
              {requests.map((item) => (
                <article
                  key={item.id}
                  className="klyx-card p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="klyx-eyebrow">
                        {item.service?.name ??
                          "Service KLYX"}{" "}
                        · {item.status}
                      </p>

                      <h3 className="mt-2 text-xl font-black">
                        {item.title}
                      </h3>

                      <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin size={15} />
                        {item.city}
                      </p>

                      <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">
                        {item.description}
                      </p>
                    </div>

                    {item.budget_max != null && (
                      <div className="rounded-2xl border border-border bg-background px-4 py-3 text-right">
                        <p className="text-xs font-black text-muted-foreground">
                          Budget max
                        </p>
                        <p className="mt-1 text-xl font-black">
                          {Number(
                            item.budget_max
                          ).toFixed(2)}{" "}
                          €
                        </p>
                      </div>
                    )}
                  </div>

                  {item.bookingQuote && (
                    <div className="mt-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5">
                      <p className="font-black text-emerald-700 dark:text-emerald-300">
                        Prestataire sélectionné
                      </p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        Le prix accepté est
                        maintenant protégé dans un
                        devis KLYX. Vérifie le
                        créneau avant de créer la
                        réservation.
                      </p>

                      <Link
                        href={`/quotes/${item.bookingQuote.id}/book`}
                        className="klyx-button mt-4"
                      >
                        Finaliser la réservation
                        <ArrowRight size={17} />
                      </Link>
                    </div>
                  )}

                  {item.status === "open" && (
                    <button
                      type="button"
                      disabled={busy === item.id}
                      onClick={() =>
                        void requestAction(
                          item.id,
                          "cancel"
                        )
                      }
                      className="mt-5 inline-flex items-center gap-2 text-sm font-black text-rose-600"
                    >
                      <Trash2 size={16} />
                      Annuler la demande
                    </button>
                  )}

                  <div className="mt-6 border-t border-border pt-5">
                    <p className="font-black">
                      Offres reçues (
                      {item.offers.length})
                    </p>

                    {item.offers.length === 0 ? (
                      <p className="mt-3 text-sm text-muted-foreground">
                        Aucune offre pour le moment.
                      </p>
                    ) : (
                      <div className="mt-3 grid gap-3">
                        {item.offers.map(
                          (offer) => (
                            <div
                              key={offer.id}
                              className="rounded-2xl border border-border bg-background/60 p-4"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="font-black">
                                    {providerName(
                                      offer
                                    )}
                                  </p>
                                  <p className="mt-1 text-sm text-muted-foreground">
                                    {offer.message ||
                                      "Aucun message."}
                                  </p>
                                </div>

                                <p className="text-xl font-black text-violet-600">
                                  {Number(
                                    offer.amount
                                  ).toFixed(2)}{" "}
                                  €
                                </p>
                              </div>

                              {item.status ===
                                "open" &&
                                offer.status ===
                                  "sent" && (
                                  <div className="mt-4 flex gap-2">
                                    <button
                                      type="button"
                                      disabled={
                                        busy ===
                                        offer.id
                                      }
                                      onClick={() =>
                                        void offerAction(
                                          item.id,
                                          offer.id,
                                          "accept"
                                        )
                                      }
                                      className="klyx-button flex-1"
                                    >
                                      <Check
                                        size={17}
                                      />
                                      Accepter
                                    </button>

                                    <button
                                      type="button"
                                      disabled={
                                        busy ===
                                        offer.id
                                      }
                                      onClick={() =>
                                        void offerAction(
                                          item.id,
                                          offer.id,
                                          "reject"
                                        )
                                      }
                                      className="klyx-button-secondary flex-1"
                                    >
                                      <X size={17} />
                                      Refuser
                                    </button>
                                  </div>
                                )}

                              {offer.status !==
                                "sent" && (
                                <p className="mt-3 text-xs font-black uppercase text-muted-foreground">
                                  {offer.status}
                                </p>
                              )}
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
