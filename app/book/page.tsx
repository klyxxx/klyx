"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Babysitter = {
  id: string;
  firstName: string;
  lastName: string;
  city: string;
  price: number | null;
};

export default function BookingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [babysitter, setBabysitter] = useState<Babysitter | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [children, setChildren] = useState("1");
  const [message, setMessage] = useState("");

  const loadBabysitter = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const babysitterId = params.id;

      if (!babysitterId) {
        throw new Error("Identifiant de la baby-sitter manquant.");
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, city")
        .eq("id", babysitterId)
        .maybeSingle();

      if (profileError) {
        throw new Error(profileError.message);
      }

      if (!profile) {
        setBabysitter(null);
        return;
      }

      const { data: service, error: serviceError } = await supabase
        .from("services")
        .select("id")
        .eq("slug", "babysitting")
        .maybeSingle();

      if (serviceError) {
        throw new Error(serviceError.message);
      }

      if (!service) {
        throw new Error("Le service Babysitting est introuvable.");
      }

      const { data: userService, error: userServiceError } = await supabase
        .from("user_services")
        .select("id")
        .eq("user_id", babysitterId)
        .eq("service_id", service.id)
        .eq("active", true)
        .maybeSingle();

      if (userServiceError) {
        throw new Error(userServiceError.message);
      }

      if (!userService) {
        setBabysitter(null);
        return;
      }

      const { data: serviceProfile, error: serviceProfileError } =
        await supabase
          .from("service_profiles")
          .select("price, city, available")
          .eq("user_service_id", userService.id)
          .maybeSingle();

      if (serviceProfileError) {
        throw new Error(serviceProfileError.message);
      }

      if (!serviceProfile || serviceProfile.available === false) {
        setBabysitter(null);
        return;
      }

      setBabysitter({
        id: profile.id,
        firstName: profile.first_name ?? "",
        lastName: profile.last_name ?? "",
        city: serviceProfile.city ?? profile.city ?? "",
        price: serviceProfile.price ?? null,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de charger la baby-sitter."
      );
      setBabysitter(null);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void loadBabysitter();
  }, [loadBabysitter]);

  async function sendRequest() {
    if (!babysitter) {
      return;
    }

    if (!date || !startTime || !endTime) {
      setErrorMessage("Complète la date et les heures.");
      return;
    }

    if (endTime <= startTime) {
      setErrorMessage("L'heure de fin doit être après l'heure de début.");
      return;
    }

    const childrenCount = Number(children);

    if (
      Number.isNaN(childrenCount) ||
      !Number.isInteger(childrenCount) ||
      childrenCount < 1
    ) {
      setErrorMessage("Le nombre d'enfants doit être au minimum 1.");
      return;
    }

    setSending(true);
    setErrorMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.push("/login");
        return;
      }

      const bookingMessage = [
        `Nombre d'enfants : ${childrenCount}`,
        message.trim(),
      ]
        .filter(Boolean)
        .join("\n\n");

      const response = await fetch("/api/bookings/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          providerId: babysitter.id,
          serviceSlug: "babysitting",
          bookingDate: date,
          startTime,
          endTime,
          message: bookingMessage,
        }),
      });

      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Impossible d'envoyer la demande.");
      }

      alert("Demande envoyée.");
      router.push("/dashboard");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible d'envoyer la demande."
      );
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        Chargement...
      </main>
    );
  }

  if (!babysitter) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-center text-white">
        <div>
          <p>Baby-sitter introuvable ou indisponible.</p>
          {errorMessage && (
            <p className="mt-3 text-sm text-red-400">{errorMessage}</p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white sm:p-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-2 text-3xl font-bold sm:text-4xl">
          Réserver une baby-sitter
        </h1>

        <p className="mb-2 text-zinc-300">
          {babysitter.firstName} {babysitter.lastName}
        </p>

        <p className="mb-10 text-sm text-zinc-500">
          {babysitter.city || "Ville non renseignée"}
          {babysitter.price !== null
            ? ` · ${babysitter.price.toFixed(2)} €/heure`
            : ""}
        </p>

        {errorMessage && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
            {errorMessage}
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label htmlFor="date" className="mb-2 block text-sm text-zinc-300">
              Date
            </label>
            <input
              id="date"
              type="date"
              min={new Date().toISOString().split("T")[0]}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-4 outline-none focus:border-violet-500"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label
                htmlFor="startTime"
                className="mb-2 block text-sm text-zinc-300"
              >
                Heure de début
              </label>
              <input
                id="startTime"
                type="time"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-4 outline-none focus:border-violet-500"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />
            </div>

            <div>
              <label
                htmlFor="endTime"
                className="mb-2 block text-sm text-zinc-300"
              >
                Heure de fin
              </label>
              <input
                id="endTime"
                type="time"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-4 outline-none focus:border-violet-500"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="children"
              className="mb-2 block text-sm text-zinc-300"
            >
              Nombre d'enfants
            </label>
            <input
              id="children"
              type="number"
              min="1"
              step="1"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-4 outline-none focus:border-violet-500"
              value={children}
              onChange={(event) => setChildren(event.target.value)}
            />
          </div>

          <div>
            <label
              htmlFor="message"
              className="mb-2 block text-sm text-zinc-300"
            >
              Message
            </label>
            <textarea
              id="message"
              rows={6}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-4 outline-none focus:border-violet-500"
              placeholder="Précise tes besoins."
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </div>

          <button
            type="button"
            onClick={sendRequest}
            disabled={sending}
            className="w-full rounded-xl bg-violet-600 py-4 text-lg font-semibold transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? "Envoi..." : "Envoyer la demande"}
          </button>
        </div>
      </div>
    </main>
  );
}
