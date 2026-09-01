"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
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
// KLYX_ACTIVITY_SPLIT_DESTINATION_2026_09_01

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
    return "border-blue-600/20 bg-blue-600/[0.06] text-blue-700 dark:text-blue-300";
  }

  return "border-border bg-background text-muted-foreground";
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
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Layers3 size={16} className="text-blue-600" />
        <span>{t("sectionTitle")}</span>
      </div>

      <div className="overflow-hidden rounded-[1.5rem] border border-border bg-card">
        {visible.map((mission, index) => {
          const needsAction = splitMissionNeedsAction(mission);

          return (
            <article
              key={mission.id}
              className={`p-5 sm:p-6 ${index > 0 ? "border-t border-border" : ""}`}
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold tracking-[-0.02em]">
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

                  {needsAction && (
                    <p className="mt-4 max-w-2xl border-l-2 border-blue-600 pl-3 text-sm leading-6 text-muted-foreground">
                      {t("dangerNotice")}
                    </p>
                  )}

                  {mission.status === "completed" && (
                    <p className="mt-4 text-sm font-medium text-muted-foreground">
                      {t("completedNotice")}
                    </p>
                  )}
                </div>

                <Link
                  href={"/bookings/split/" + mission.batchId}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                >
                  {t("viewMission")}
                  <ArrowRight size={16} />
                </Link>
              </div>

              <details className="group mt-5 border-t border-border pt-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-muted-foreground transition hover:text-foreground marker:hidden">
                  <span>{t("sectionEyebrow")}</span>
                  <ChevronDown
                    size={17}
                    className="transition group-open:rotate-180"
                  />
                </summary>

                <div className="mt-4 divide-y divide-border border-y border-border">
                  {mission.slots.map((slot) => (
                    <div
                      key={slot.slotId}
                      className="flex items-center justify-between gap-3 py-3"
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

                      <p className="shrink-0 text-xs font-medium text-muted-foreground">
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
