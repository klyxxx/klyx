"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type AvailabilitySlotRow = {
  id: string;
  user_service_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

type DayAvailability = {
  dayOfWeek: number;
  enabled: boolean;
  startTime: string;
  endTime: string;
};

type AvailabilityEditorProps = {
  userServiceId: string;
};

const DAYS = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
  { value: 6, label: "Samedi" },
  { value: 0, label: "Dimanche" },
];

function createDefaultDays(): DayAvailability[] {
  return DAYS.map((day) => ({
    dayOfWeek: day.value,
    enabled: false,
    startTime: "09:00",
    endTime: "18:00",
  }));
}

export default function AvailabilityEditor({
  userServiceId,
}: AvailabilityEditorProps) {
  const [days, setDays] = useState<DayAvailability[]>(createDefaultDays);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const activeDaysCount = useMemo(
    () => days.filter((day) => day.enabled).length,
    [days]
  );

  const loadAvailability = useCallback(async () => {
    if (!userServiceId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const { data, error } = await supabase
        .from("availability_slots")
        .select(
          "id, user_service_id, day_of_week, start_time, end_time, is_active"
        )
        .eq("user_service_id", userServiceId)
        .eq("is_active", true)
        .order("day_of_week", { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      const slots = (data ?? []) as AvailabilitySlotRow[];

      setDays(
        createDefaultDays().map((day) => {
          const slot = slots.find(
            (item) => item.day_of_week === day.dayOfWeek
          );

          if (!slot) {
            return day;
          }

          return {
            dayOfWeek: day.dayOfWeek,
            enabled: true,
            startTime: slot.start_time.slice(0, 5),
            endTime: slot.end_time.slice(0, 5),
          };
        })
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de charger les disponibilités."
      );
    } finally {
      setLoading(false);
    }
  }, [userServiceId]);

  useEffect(() => {
    void loadAvailability();
  }, [loadAvailability]);

  function updateDay(
    dayOfWeek: number,
    changes: Partial<DayAvailability>
  ) {
    setDays((currentDays) =>
      currentDays.map((day) =>
        day.dayOfWeek === dayOfWeek ? { ...day, ...changes } : day
      )
    );
  }

  async function saveAvailability() {
    if (!userServiceId) {
      setErrorMessage("Le service utilisateur est introuvable.");
      return;
    }

    const invalidDay = days.find(
      (day) => day.enabled && day.endTime <= day.startTime
    );

    if (invalidDay) {
      const label =
        DAYS.find((day) => day.value === invalidDay.dayOfWeek)?.label ??
        "Un jour";

      setErrorMessage(
        `${label} : l'heure de fin doit être après l'heure de début.`
      );
      return;
    }

    setSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      const { error: deleteError } = await supabase
        .from("availability_slots")
        .delete()
        .eq("user_service_id", userServiceId);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      const enabledDays = days.filter((day) => day.enabled);

      if (enabledDays.length > 0) {
        const { error: insertError } = await supabase
          .from("availability_slots")
          .insert(
            enabledDays.map((day) => ({
              user_service_id: userServiceId,
              day_of_week: day.dayOfWeek,
              start_time: day.startTime,
              end_time: day.endTime,
              is_active: true,
              updated_at: new Date().toISOString(),
            }))
          );

        if (insertError) {
          throw new Error(insertError.message);
        }
      }

      setMessage("Disponibilités enregistrées.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible d'enregistrer les disponibilités."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-8">
        <p className="text-zinc-400">Chargement des disponibilités...</p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-8">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Disponibilités hebdomadaires</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Sélectionne les jours et les horaires pendant lesquels les clients
          peuvent te réserver.
        </p>
        <p className="mt-2 text-sm text-violet-300">
          {activeDaysCount} jour{activeDaysCount > 1 ? "s" : ""} actif
          {activeDaysCount > 1 ? "s" : ""}
        </p>
      </div>

      {errorMessage && (
        <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
          {errorMessage}
        </div>
      )}

      {message && (
        <div className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-300">
          {message}
        </div>
      )}

      <div className="space-y-4">
        {DAYS.map((dayDefinition) => {
          const day = days.find(
            (item) => item.dayOfWeek === dayDefinition.value
          );

          if (!day) {
            return null;
          }

          return (
            <div
              key={day.dayOfWeek}
              className="grid gap-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 md:grid-cols-[160px_1fr_1fr]"
            >
              <label className="flex items-center gap-3 font-medium">
                <input
                  type="checkbox"
                  checked={day.enabled}
                  onChange={(event) =>
                    updateDay(day.dayOfWeek, {
                      enabled: event.target.checked,
                    })
                  }
                  className="h-5 w-5 accent-violet-600"
                />
                {dayDefinition.label}
              </label>

              <div>
                <label className="mb-2 block text-xs text-zinc-500">
                  Début
                </label>
                <input
                  type="time"
                  value={day.startTime}
                  disabled={!day.enabled}
                  onChange={(event) =>
                    updateDay(day.dayOfWeek, {
                      startTime: event.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs text-zinc-500">
                  Fin
                </label>
                <input
                  type="time"
                  value={day.endTime}
                  disabled={!day.enabled}
                  onChange={(event) =>
                    updateDay(day.dayOfWeek, {
                      endTime: event.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
                />
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={saveAvailability}
        disabled={saving}
        className="mt-6 w-full rounded-2xl bg-violet-600 px-6 py-4 text-lg font-semibold hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving
          ? "Enregistrement..."
          : "Enregistrer les disponibilités"}
      </button>
    </section>
  );
}