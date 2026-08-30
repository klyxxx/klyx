"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Layers3,
  UserRound,
  UsersRound,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  formatKlyxSplitMissionDate,
  formatKlyxSplitMissionService,
  formatKlyxSplitMissionStatus,
  formatKlyxSplitMissionSummary,
  translateKlyxSplitMission,
  type KlyxSplitMissionMessageKey,
} from "@/lib/klyx-split-mission-i18n";

// KLYX_SPLIT_MISSION_UI_13_21
// KLYX_SPLIT_MISSION_I18N_16_08

export type SplitMissionState =
  | "creating"
  | "recovery_required"
  | "awaiting_providers"
  | "partially_accepted"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "mixed_issue";

export type SplitMissionSlot = {
  slotId: string;
  position: number;
  date: string;
  startTime: string;
  endTime: string;
  budgetMax: number | null;
  providerId: string;
  providerName: string;
  providerAvatar: string | null;
  bookingId: string | null;
  bookingStatus: string;
  serviceStatus: string;
};

export type SplitMissionSummary = {
  id: string;
  batchId: string;
  marketRequestId: string;
  confirmationId: string;
  status: SplitMissionState;
  batchStatus: string;
  serviceId: string | null;
  serviceName: string;
  serviceSlug: string | null;
  slotCount: number;
  createdBookingCount: number;
  providerCount: number;
  firstDate: string | null;
  lastDate: string | null;
  createdAt: string;
  failureReason: string | null;
  actionRequired: boolean;
  slots: SplitMissionSlot[];
  childBookingIds: string[];
};

export type SplitMissionFilter =
  | "actions"
  | "upcoming"
  | "history"
  | "all";

export function splitMissionNeedsAction(
  mission: SplitMissionSummary
): boolean {
  return (
    mission.status === "recovery_required" ||
    mission.status === "mixed_issue"
  );
}

export function splitMissionIsHistory(
  mission: SplitMissionSummary
): boolean {
  return mission.status === "completed" || mission.status === "cancelled";
}

export function splitMissionMatchesFilter(
  mission: SplitMissionSummary,
  filter: SplitMissionFilter
): boolean {
  if (filter === "actions") {
    return splitMissionNeedsAction(mission);
  }

  if (filter === "upcoming") {
    return !splitMissionIsHistory(mission);
  }

  if (filter === "history") {
    return splitMissionIsHistory(mission);
  }

  return true;
}

function statusClass(mission: SplitMissionSummary) {
  if (splitMissionNeedsAction(mission)) {
    return "border-red-500/25 bg-red-500/8 text-red-700 dark:text-red-300";
  }

  if (mission.status === "completed") {
    return "border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300";
  }

  return "border-blue-600/20 bg-blue-600/8 text-blue-700 dark:text-blue-300";
}

export default function SplitMissionSection({
  missions,
  filter,
}: {
  missions: SplitMissionSummary[];
  filter: SplitMissionFilter;
}) {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxSplitMissionMessageKey) =>
    translateKlyxSplitMission(locale, key);

  const visible = missions.filter((mission) =>
    splitMissionMatchesFilter(mission, filter)
  );

  if (visible.length === 0) return null;

  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400">
        <Layers3 size={17} />
        <span>{t("sectionTitle")}</span>
      </div>

      <div className="space-y-4">
        {visible.map((mission) => {
          const needsAction = splitMissionNeedsAction(mission);

          return (
            <article
              key={mission.id}
              className={`rounded-2xl border bg-card p-5 shadow-sm sm:p-6 ${
                needsAction ? "border-red-500/25" : "border-border"
              }`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">
                      {formatKlyxSplitMissionService(
                        locale,
                        mission.serviceSlug,
                        mission.serviceName
                      )}
                    </h3>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(
                        mission
                      )}`}
                    >
                      {formatKlyxSplitMissionStatus(locale, mission.status)}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-muted-foreground">
                    {formatKlyxSplitMissionSummary(locale, mission.slotCount)}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <CalendarDays size={15} />
                      {formatKlyxSplitMissionDate(locale, mission.firstDate)}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <UsersRound size={15} />
                      {mission.providerCount} {t("providers").toLowerCase()}
                    </span>
                  </div>
                </div>

                <Link
                  href={"/bookings/split/" + mission.batchId}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-500"
                >
                  {t("viewMission")}
                  <ArrowRight size={16} />
                </Link>
              </div>

              {needsAction && (
                <div className="mt-5 flex gap-3 rounded-xl border border-red-500/20 bg-red-500/8 p-4 text-sm text-red-700 dark:text-red-300">
                  <AlertTriangle className="mt-0.5 shrink-0" size={18} />
                  <p>{t("dangerNotice")}</p>
                </div>
              )}

              {mission.status === "completed" && (
                <div className="mt-5 flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 size={17} />
                  {t("completedNotice")}
                </div>
              )}

              <details className="group mt-5 border-t border-border pt-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-muted-foreground transition hover:text-foreground marker:hidden">
                  <span>{t("sectionEyebrow")}</span>
                  <ChevronDown
                    size={17}
                    className="transition group-open:rotate-180"
                  />
                </summary>

                <div className="mt-4 space-y-2">
                  {mission.slots.map((slot) => (
                    <div
                      key={slot.slotId}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-muted">
                          {slot.providerAvatar ? (
                            <img
                              src={slot.providerAvatar}
                              alt={slot.providerName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <UserRound size={17} />
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {slot.providerName}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock3 size={12} />
                            {slot.startTime.slice(0, 5)} – {slot.endTime.slice(0, 5)}
                          </p>
                        </div>
                      </div>

                      <p className="shrink-0 text-xs font-medium">
                        {formatKlyxSplitMissionDate(locale, slot.date)}
                      </p>
                    </div>
                  ))}
                </div>

                <p className="mt-4 text-xs leading-5 text-muted-foreground">
                  {t("paymentNotice")}
                </p>
              </details>
            </article>
          );
        })}
      </div>
    </section>
  );
}
