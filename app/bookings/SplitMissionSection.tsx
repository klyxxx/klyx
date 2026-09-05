"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  Clock3,
  Layers3,
  LoaderCircle,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import { translateKlyxActivityDelete } from "@/lib/klyx-activity-delete-i18n";
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
// KLYX_ACTIVITY_RECENT_DELETE_2026_09_05

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
  if (filter === "actions") return splitMissionNeedsAction(mission);
  if (filter === "upcoming") return !splitMissionIsHistory(mission);
  if (filter === "history") return splitMissionIsHistory(mission);
  return true;
}

function statusClass(mission: SplitMissionSummary) {
  if (splitMissionNeedsAction(mission)) {
    return "border-[#2563EB]/20 bg-[#2563EB]/[0.06] text-[#2563EB]";
  }

  return "border-border bg-background text-muted-foreground";
}

export function SplitMissionCardView({
  mission,
  divided = false,
  deleting = false,
  onDelete,
}: {
  mission: SplitMissionSummary;
  divided?: boolean;
  deleting?: boolean;
  onDelete?: (mission: SplitMissionSummary) => void | Promise<void>;
}) {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxSplitMissionMessageKey) =>
    translateKlyxSplitMission(locale, key);
  const needsAction = splitMissionNeedsAction(mission);

  return (
    <article
      className={`p-4 sm:p-5 ${divided ? "border-t border-border" : ""}`}
      data-created-at={mission.createdAt}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
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

          <p className="mt-1.5 text-sm text-muted-foreground">
            {formatKlyxSplitMissionSummary(locale, mission.slotCount)}
          </p>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
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
            <p className="mt-3 max-w-2xl border-l-2 border-[#2563EB] pl-3 text-sm leading-6 text-muted-foreground">
              {t("dangerNotice")}
            </p>
          )}

          {mission.status === "completed" && (
            <p className="mt-3 text-sm font-medium text-muted-foreground">
              {t("completedNotice")}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <Link
            href={"/bookings/split/" + mission.batchId}
            className="inline-flex min-h-10 items-center justify-center gap-2 text-sm font-semibold text-[#2563EB] transition hover:opacity-75"
          >
            {t("viewMission")}
            <ArrowRight size={16} />
          </Link>

          {onDelete && (
            <button
              type="button"
              onClick={() => void onDelete(mission)}
              disabled={deleting}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold text-muted-foreground transition hover:border-red-500/30 hover:text-red-600 disabled:opacity-50"
            >
              {deleting ? (
                <LoaderCircle size={15} className="animate-spin" />
              ) : (
                <Trash2 size={15} />
              )}
              {translateKlyxActivityDelete(
                locale,
                deleting ? "deleting" : "delete"
              )}
            </button>
          )}
        </div>
      </div>

      <details className="group mt-4 border-t border-border pt-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-muted-foreground transition hover:text-foreground marker:hidden">
          <span>{t("sectionEyebrow")}</span>
          <ChevronDown
            size={17}
            className="transition group-open:rotate-180"
          />
        </summary>

        <div className="mt-3 divide-y divide-border border-y border-border">
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

        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          {t("paymentNotice")}
        </p>
      </details>
    </article>
  );
}

export default function SplitMissionSection({
  missions,
  filter,
  deletingKey,
  onDelete,
}: {
  missions: SplitMissionSummary[];
  filter: SplitMissionFilter;
  deletingKey?: string | null;
  onDelete?: (mission: SplitMissionSummary) => void | Promise<void>;
}) {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxSplitMissionMessageKey) =>
    translateKlyxSplitMission(locale, key);

  const visible = missions
    .filter((mission) => splitMissionMatchesFilter(mission, filter))
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt));

  if (visible.length === 0) return null;

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Layers3 size={16} className="text-[#2563EB]" />
        <span>{t("sectionTitle")}</span>
      </div>

      <div className="overflow-hidden rounded-[1.25rem] border border-border bg-card">
        {visible.map((mission, index) => (
          <SplitMissionCardView
            key={mission.id}
            mission={mission}
            divided={index > 0}
            deleting={deletingKey === `split:${mission.id}`}
            onDelete={onDelete}
          />
        ))}
      </div>
    </section>
  );
}
