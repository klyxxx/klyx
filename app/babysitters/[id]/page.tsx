"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AvailabilitySlot = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type Babysitter = {
  id: string;
  firstName: string;
  lastName: string;
  city: string;
  price: number | null;
  userServiceId: string;
};

const DAY_LABELS: Record<number, string> = {
  0: "Dimanche",
  1: "Lundi",
  2: "Mardi",
  3: "Mercredi",
  4: "Jeudi",
  5: "Vendredi",
  6: "Samedi",
};

export default function BookingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [babysitter, setBabysitter] = useState<Babysitter | null>(null);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [children, setChildren] = useState("1");
  const [message, setMessage] = useState("");

  const selectedDayOfWeek = useMemo(() => {
    if (!date) return null;
    return new Date(`${date}T12:00:00`).getDay();
  }, [date]);

  const selectedDaySlots = useMemo(() => {
    if (selectedDayOfWeek === null) return [];

    return availability
      .filter((slot) => slot.day_of_week === selectedDayOfWeek)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [availability, selectedDayOfWeek]);

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

      if (profileError) throw new Error(profileError.message);
      if (!profile) {
        setBabysitter(null);
        return;
      }

      const { data: service, error: serviceError } = await supabase
        .from("services")
        .select("id")
        .eq("slug", "babysitting")
        .maybeSingle();

      if (serviceError) throw new Error(serviceError.message);
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

      if (userServiceError) throw new Error(userServiceError.message);
      if (!userService) {
        setBabysitter(null);
        return;
      }

      const [
        { data: serviceProfile, error: serviceProfileError },
        { data: slots, error: slotsError },
      ] = await Promise.all([
        supabase
          .from("service_profiles")
          .select("price, city, available")
          .eq("user_service_id", userService.id)
          .maybeSingle(),
        supabase
          .from("availability_slots")
          .select("id, day_of_week, start_time, end_time")
          .eq("user_service_id", userService.id)
          .eq("is_active", true),
      ]);

      if (serviceProfileError) throw new Error(serviceProfileError.message);
      if (slotsError) throw new Error(slotsError.message);

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
        userServiceId: userService.id,
      });

      setAvailability((slots ?? []) as AvailabilitySlot[]);
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

  function isInsideAvailability() {
    if (selectedDaySlots.length === 0) return false;

    return selectedDaySlots.some(
      (slot) =>
        startTime >= slot.start_time.slice(0, 5) &&
        endTime <= slot.end_time.slice(0, 5)
    );
  }

  async function sendRequest() {
    if (!babysitter) return;

    if (!date || !startTime || !endTime) {
      setErrorMessage("Complète la date et les heures.");
      return;
    }

    if (endTime <= startTime) {
      setErrorMessage("L'heure de fin doit être après l'heure de début.");
      return;
    }

    if (selectedDaySlots.length === 0) {
      setErrorMessage(
        "La baby-sitter n'est pas disponible ce jour-là."
      );
      return;
    }

    if (!isInsideAvailability()) {
      setErrorMessage(
        "Les heures choisies sont en dehors des disponibilités."
      );
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

        <p className="mb-8 text-sm text-zinc-500">
          {babysitter.city || "Ville non renseignée"}
          {babysitter.price !== null
            ? ` · ${babysitter.price.toFixed(2)} €/heure`
            : ""}
        </p>

        <section className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="font-semibold">Disponibilités hebdomadaires</h2>

          {availability.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-400">
              Aucune disponibilité renseignée.
            </p>
          ) : (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {availability
                .slice()
                .sort(
                  (a, b) =>
                    dayOrder(a.day_of_week) - dayOrder(b.day_of_week)
                )
                .map((slot) => (
                  <div
                    key={slot.id}
                    className="flex justify-between rounded-xl bg-zinc-950 px-4 py-3 text-sm"
                  >
                    <span>{DAY_LABELS[slot.day_of_week]}</span>
                    <span className="text-zinc-400">
                      {slot.start_time.slice(0, 5)} →{" "}
                      {slot.end_time.slice(0, 5)}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </section>

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
              onChange={(event) => {
                setDate(event.target.value);
                setStartTime("");
                setEndTime("");
                setErrorMessage("");
              }}
            />

            {date && (
              <p
                className={`mt-2 text-sm ${
                  selectedDaySlots.length > 0
                    ? "text-emerald-400"
                    : "text-red-400"
                }`}
              >
                {selectedDaySlots.length > 0
                  ? `Disponible le ${DAY_LABELS[selectedDayOfWeek ?? 0]} : ${selectedDaySlots
                      .map(
                        (slot) =>
                          `${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)}`
                      )
                      .join(", ")}`
                  : `Indisponible le ${DAY_LABELS[selectedDayOfWeek ?? 0]}`}
              </p>
            )}
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
                disabled={!date || selectedDaySlots.length === 0}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-4 outline-none focus:border-violet-500 disabled:opacity-40"
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
                disabled={!date || selectedDaySlots.length === 0}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-4 outline-none focus:border-violet-500 disabled:opacity-40"
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
            disabled={
              sending ||
              !date ||
              selectedDaySlots.length === 0 ||
              !startTime ||
              !endTime
            }
            className="w-full rounded-xl bg-violet-600 py-4 text-lg font-semibold transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? "Envoi..." : "Envoyer la demande"}
          </button>
        </div>
      </div>
    </main>
  );
}

function dayOrder(dayOfWeek: number) {
  return dayOfWeek === 0 ? 7 : dayOfWeek;
}
