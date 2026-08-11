"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  Euro,
  FileText,
  LoaderCircle,
  Send,
  UserRound,
} from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

type ServiceRow = {
  id: string;
  name: string;
  slug: string;
};

type ServiceProfileRow = {
  pricing_type: "hourly" | "fixed" | string | null;
  price: number | null;
  available: boolean | null;
};

function money(value: number | null): string {
  return value == null ? "À confirmer" : `${Number(value).toFixed(2)} €`;
}

export default function ProviderQuoteRequestPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const providerId = params.id;
  const serviceSlug = searchParams.get("service")?.trim() || "";

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [service, setService] = useState<ServiceRow | null>(null);
  const [userServiceId, setUserServiceId] = useState("");
  const [serviceProfile, setServiceProfile] = useState<ServiceProfileRow | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requestedDate, setRequestedDate] = useState("");
  const [requestedTime, setRequestedTime] = useState("");
  const [durationHours, setDurationHours] = useState("1");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setErrorMessage("");

      try {
        if (!serviceSlug) throw new Error("Aucun métier n’a été sélectionné.");

        const [profileResult, serviceResult] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, first_name, last_name, avatar_url")
            .eq("id", providerId)
            .maybeSingle(),
          supabase
            .from("services")
            .select("id, name, slug")
            .eq("slug", serviceSlug)
            .maybeSingle(),
        ]);

        if (profileResult.error) throw new Error(profileResult.error.message);
        if (serviceResult.error) throw new Error(serviceResult.error.message);
        if (!profileResult.data) throw new Error("Prestataire introuvable.");
        if (!serviceResult.data) throw new Error("Métier introuvable.");

        const serviceData = serviceResult.data as ServiceRow;

        const userServiceResult = await supabase
          .from("user_services")
          .select("id")
          .eq("user_id", providerId)
          .eq("service_id", serviceData.id)
          .eq("active", true)
          .eq("provider_enabled", true)
          .maybeSingle();

        if (userServiceResult.error) throw new Error(userServiceResult.error.message);
        if (!userServiceResult.data) {
          throw new Error("Ce métier n’est pas actif pour ce prestataire.");
        }

        const serviceProfileResult = await supabase
          .from("service_profiles")
          .select("pricing_type, price, available")
          .eq("user_service_id", userServiceResult.data.id)
          .eq("available", true)
          .maybeSingle();

        if (serviceProfileResult.error) {
          throw new Error(serviceProfileResult.error.message);
        }

        if (!serviceProfileResult.data) {
          throw new Error("Ce prestataire n’accepte pas encore les demandes pour ce métier.");
        }

        if (!active) return;

        setProfile(profileResult.data as ProfileRow);
        setService(serviceData);
        setUserServiceId(userServiceResult.data.id);
        setServiceProfile(serviceProfileResult.data as ServiceProfileRow);
        setTitle(`Demande de devis — ${serviceData.name}`);
      } catch (error) {
        if (!active) return;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Impossible de préparer la demande de devis."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [providerId, serviceSlug]);

  const estimatedTotal = useMemo(() => {
    if (serviceProfile?.price == null) return null;
    const unitPrice = Number(serviceProfile.price);

    if (serviceProfile.pricing_type === "fixed") return unitPrice;

    const duration = Number(durationHours);
    if (!Number.isFinite(duration) || duration <= 0 || duration > 48) return null;

    return unitPrice * duration;
  }, [durationHours, serviceProfile]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || sent) return;

    setSubmitting(true);
    setErrorMessage("");

    try {
      if (!profile || !service || !userServiceId) {
        throw new Error("Demande incomplète.");
      }

      if (title.trim().length < 3) throw new Error("Ajoute un titre plus précis.");
      if (description.trim().length < 10) {
        throw new Error("Décris ton besoin en au moins 10 caractères.");
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) throw new Error("Session manquante.");

      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          providerProfileId: providerId,
          userServiceId,
          title: title.trim(),
          description: description.trim(),
          requestedDate: requestedDate || null,
          requestedTime: requestedTime || null,
          durationHours: durationHours.trim() === "" ? null : Number(durationHours),
        }),
      });

      const body = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.error || "Impossible d’envoyer la demande.");
      }

      setSent(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible d’envoyer la demande."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="klyx-page grid min-h-screen place-items-center">
        <LoaderCircle className="animate-spin text-violet-600" size={38} />
      </main>
    );
  }

  if (errorMessage && !profile) {
    return (
      <main className="klyx-page">
        <div className="mx-auto max-w-3xl rounded-3xl border border-rose-500/25 bg-rose-500/10 p-6 text-rose-700 dark:text-rose-300">
          {errorMessage}
        </div>
      </main>
    );
  }

  const fullName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    "Prestataire KLYX";

  if (sent) {
    return (
      <main className="klyx-page">
        <section className="klyx-card mx-auto max-w-3xl p-8 text-center sm:p-10">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-emerald-500/10 text-emerald-600">
            <FileText size={30} />
          </div>
          <h1 className="mt-6 text-3xl font-black">Demande envoyée</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
            {fullName} peut maintenant confirmer un prix et ajouter un message.
            Tu pourras ensuite accepter ou refuser le devis avant toute réservation.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/quotes" className="klyx-button">
              Voir mes devis
            </Link>
            <Link href={`/providers/${providerId}`} className="klyx-button-secondary">
              Retour au profil
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-5xl">
        <Link
          href={`/providers/${providerId}`}
          className="inline-flex items-center gap-2 text-sm font-black text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={17} />
          Retour au profil
        </Link>

        <section className="mt-6 grid overflow-hidden rounded-3xl border border-border bg-card md:grid-cols-[240px_1fr]">
          <div className="grid min-h-56 place-items-center bg-muted">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={fullName}
                className="h-full min-h-56 w-full object-cover"
              />
            ) : (
              <UserRound size={72} className="text-muted-foreground" />
            )}
          </div>

          <div className="p-6 sm:p-8">
            <p className="klyx-eyebrow">Demande de devis</p>
            <h1 className="mt-2 text-3xl font-black">
              {service?.name ?? "Service KLYX"}
            </h1>
            <p className="mt-2 font-black text-violet-600">{fullName}</p>

            <div className="mt-5 flex flex-wrap gap-3">
              <span className="rounded-full border border-border bg-background px-3 py-2 text-sm">
                Tarif affiché :{" "}
                <strong>
                  {money(serviceProfile?.price ?? null)}
                  {serviceProfile?.pricing_type === "hourly" ? "/h" : ""}
                </strong>
              </span>
              <span className="rounded-full border border-border bg-background px-3 py-2 text-sm">
                Estimation : <strong>{money(estimatedTotal)}</strong>
              </span>
            </div>
          </div>
        </section>

        <form onSubmit={submit} className="klyx-card mt-6 p-6 sm:p-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-2 block text-sm font-black">Titre</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                className="klyx-input"
                required
              />
            </label>

            <label className="sm:col-span-2">
              <span className="mb-2 block text-sm font-black">
                Décris précisément ton besoin
              </span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={7}
                maxLength={2000}
                className="klyx-input min-h-44 resize-none p-4"
                placeholder="Travail à réaliser, contraintes, matériel disponible..."
                required
              />
            </label>

            <label>
              <span className="mb-2 flex items-center gap-2 text-sm font-black">
                <CalendarDays size={17} />
                Date souhaitée
              </span>
              <input
                type="date"
                value={requestedDate}
                onChange={(event) => setRequestedDate(event.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="klyx-input"
              />
            </label>

            <label>
              <span className="mb-2 flex items-center gap-2 text-sm font-black">
                <Clock3 size={17} />
                Heure souhaitée
              </span>
              <input
                type="time"
                value={requestedTime}
                onChange={(event) => setRequestedTime(event.target.value)}
                className="klyx-input"
              />
            </label>

            <label className="sm:col-span-2">
              <span className="mb-2 flex items-center gap-2 text-sm font-black">
                <Euro size={17} />
                Durée estimée
              </span>
              <input
                type="number"
                min="0.5"
                max="48"
                step="0.5"
                value={durationHours}
                onChange={(event) => setDurationHours(event.target.value)}
                className="klyx-input"
              />
            </label>
          </div>

          {errorMessage && (
            <div className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
              {errorMessage}
            </div>
          )}

          <div className="mt-7 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm leading-6 text-muted-foreground">
            Une demande de devis ne réserve rien et ne déclenche aucun paiement.
            Le prestataire envoie d’abord son prix, puis tu choisis de l’accepter ou non.
          </div>

          <button
            type="submit"
            disabled={submitting || description.trim().length < 10}
            className="klyx-button mt-5 w-full"
          >
            {submitting ? (
              <LoaderCircle className="animate-spin" size={19} />
            ) : (
              <Send size={19} />
            )}
            {submitting ? "Envoi..." : "Demander un devis"}
          </button>
        </form>
      </div>
    </main>
  );
}
