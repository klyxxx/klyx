"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  formatKlyxProviderAvailabilityActiveDays,
  formatKlyxProviderAvailabilityInvalidTime,
  translateKlyxProviderAvailability,
  translateKlyxProviderAvailabilityDay,
  type KlyxProviderAvailabilityDayKey,
  type KlyxProviderAvailabilityMessageKey,
} from "@/lib/klyx-provider-availability-i18n";
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

const DAYS: ReadonlyArray<{
  value: number;
  key: KlyxProviderAvailabilityDayKey;
}> = [
  { value: 1, key: "monday" },
  { value: 2, key: "tuesday" },
  { value: 3, key: "wednesday" },
  { value: 4, key: "thursday" },
  { value: 5, key: "friday" },
  { value: 6, key: "saturday" },
  { value: 0, key: "sunday" },
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
  const { locale } = useKlyxLocale();
  const t = (key: KlyxProviderAvailabilityMessageKey) =>
    translateKlyxProviderAvailability(locale, key);

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
        throw new Error("KLYX_PROVIDER_AVAILABILITY_LOAD_FAILED");
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
    } catch {
      setErrorMessage(t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [locale, userServiceId]);

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
      setErrorMessage(t("serviceMissing"));
      return;
    }

    const invalidDay = days.find(
      (day) => day.enabled && day.endTime <= day.startTime
    );

    if (invalidDay) {
      const dayKey = DAYS.find(
        (day) => day.value === invalidDay.dayOfWeek
      )?.key;
      const label = dayKey
        ? translateKlyxProviderAvailabilityDay(locale, dayKey)
        : t("dayFallback");

      setErrorMessage(
        formatKlyxProviderAvailabilityInvalidTime(locale, label)
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
        throw new Error("KLYX_PROVIDER_AVAILABILITY_DELETE_FAILED");
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
          throw new Error("KLYX_PROVIDER_AVAILABILITY_INSERT_FAILED");
        }
      }

      setMessage(t("saved"));
    } catch {
      setErrorMessage(t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-3xl border border-border bg-card/60 p-6 dark:border-zinc-800 dark:bg-zinc-900/60 sm:p-8">
        <p className="text-muted-foreground dark:text-zinc-400">
          {t("loading")}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-border bg-card/60 p-6 dark:border-zinc-800 dark:bg-zinc-900/60 sm:p-8">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">{t("title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground dark:text-zinc-400">
          {t("description")}
        </p>
        <p className="mt-2 text-sm font-medium text-[#2563EB]">
          {formatKlyxProviderAvailabilityActiveDays(locale, activeDaysCount)}
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
              className="grid gap-4 rounded-2xl border border-border bg-background p-4 dark:border-zinc-800 dark:bg-zinc-950 md:grid-cols-[160px_1fr_1fr]"
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
                  className="h-5 w-5 accent-[#2563EB]"
                />
                {translateKlyxProviderAvailabilityDay(locale, dayDefinition.key)}
              </label>

              <div>
                <label className="mb-2 block text-xs text-muted-foreground dark:text-zinc-500">
                  {t("start")}
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
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs text-muted-foreground dark:text-zinc-500">
                  {t("end")}
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
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900"
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
        className="mt-6 w-full rounded-2xl bg-[#2563EB] px-6 py-4 text-lg font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? t("saving") : t("save")}
      </button>
    </section>
  );
}
