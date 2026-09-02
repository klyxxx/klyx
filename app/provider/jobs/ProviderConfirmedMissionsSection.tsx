"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  CreditCard,
  Layers3,
  UserRound,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  formatKlyxBookingAmount,
  formatKlyxBookingDateRange,
  formatKlyxBookingSlotCount,
  formatKlyxBookingStatus,
} from "@/lib/klyx-bookings-page-i18n";
import { formatKlyxBookingServiceFromSlug } from "@/lib/klyx-bookings-service-i18n";
import {
  translateKlyxProviderMissions,
  type KlyxProviderMissionsMessageKey,
} from "@/lib/klyx-provider-missions-i18n";

export type ProviderMissionCard = {
  id: string;
  entityType: "booking" | "group";
  href: string;
  role: "client" | "provider";
  otherUserName: string;
  otherUserAvatar: string | null;
  serviceLabel: string;
  serviceSlug: string | null;
  status: string;
  statusLabel: string;
  paymentStatus: string;
  amountCents: number | null;
  currency: string;
  dateFrom: string;
  dateTo: string;
  firstStart: string;
  lastEnd: string;
  slotCount: number;
  actionRequired: boolean;
  history: boolean;
  cancellationPending: boolean;
  refundStatus: string;
  createdAt: string;
};

export function providerMissionPriority(card: ProviderMissionCard): number {
  if (card.actionRequired) return 0;
  if (!card.history) return 1;
  return 2;
}

function serviceLabel(locale: string, card: ProviderMissionCard) {
  return formatKlyxBookingServiceFromSlug(
    locale,
    card.serviceSlug,
    card.serviceLabel
  );
}

function missionDate(locale: string, card: ProviderMissionCard) {
  return formatKlyxBookingDateRange(locale, card.dateFrom, card.dateTo);
}

function missionTime(locale: string, card: ProviderMissionCard) {
  if (card.entityType === "group") {
    return formatKlyxBookingSlotCount(locale, card.slotCount);
  }

  return `${card.firstStart.slice(0, 5)} - ${card.lastEnd.slice(0, 5)}`;
}

function statusClass(card: ProviderMissionCard) {
  if (card.actionRequired) {
    return "border-blue-600/20 bg-blue-600/[0.06] text-blue-700 dark:text-blue-300";
  }

  return "border-border bg-background text-muted-foreground";
}

export default function ProviderConfirmedMissionsSection({
  missions,
  priorityMissionId = null,
}: {
  missions: ProviderMissionCard[];
  priorityMissionId?: string | null;
}) {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxProviderMissionsMessageKey) =>
    translateKlyxProviderMissions(locale, key);
  const visible = missions.filter((mission) => mission.id !== priorityMissionId);

  if (visible.length === 0) return null;

  return (
    <section className="mt-10" aria-label={t("confirmed")}>
      <h2 className="text-lg font-semibold tracking-[-0.02em]">
        {t("confirmed")}
      </h2>

      <div className="mt-3 overflow-hidden rounded-[1.5rem] border border-border bg-card">
        {visible.map((mission, index) => (
          <ProviderConfirmedMissionCard
            key={`${mission.entityType}:${mission.id}`}
            mission={mission}
            divided={index > 0}
          />
        ))}
      </div>
    </section>
  );
}

export function ProviderConfirmedMissionCard({
  mission,
  featured = false,
  divided = false,
}: {
  mission: ProviderMissionCard;
  featured?: boolean;
  divided?: boolean;
}) {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxProviderMissionsMessageKey) =>
    translateKlyxProviderMissions(locale, key);

  return (
    <article
      className={
        featured
          ? "rounded-[1.5rem] border border-border bg-card p-5 sm:p-6"
          : `p-5 sm:p-6 ${divided ? "border-t border-border" : ""}`
      }
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-muted">
              {mission.otherUserAvatar ? (
                <img
                  src={mission.otherUserAvatar}
                  alt={mission.otherUserName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserRound size={18} className="text-muted-foreground" />
              )}
            </div>

            <div className="min-w-0">
              <p className="truncate font-semibold">{mission.otherUserName}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {serviceLabel(locale, mission)}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(
                mission
              )}`}
            >
              {formatKlyxBookingStatus(locale, mission.status)}
            </span>

            {mission.actionRequired && (
              <span className="text-xs font-semibold text-blue-600">
                {t("actionRequired")}
              </span>
            )}

            {mission.entityType === "group" && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Layers3 size={13} className="text-blue-600" />
                {formatKlyxBookingSlotCount(locale, mission.slotCount)}
              </span>
            )}
          </div>

          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
            <MiniInfo
              icon={<CalendarDays size={15} />}
              label={t("schedule")}
              value={missionDate(locale, mission)}
            />
            <MiniInfo
              icon={<Clock3 size={15} />}
              label={t("schedule")}
              value={missionTime(locale, mission)}
            />
            <MiniInfo
              icon={<CreditCard size={15} />}
              label={t("amount")}
              value={formatKlyxBookingAmount(
                locale,
                mission.amountCents,
                mission.currency
              )}
            />
          </div>
        </div>

        <Link
          href={mission.href}
          className={
            featured
              ? "klyx-button inline-flex min-h-11 shrink-0 items-center justify-center gap-2 px-4 text-sm font-semibold"
              : "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 text-sm font-semibold text-blue-600 transition hover:text-blue-700"
          }
        >
          {t("viewMission")}
          <ArrowRight size={16} />
        </Link>
      </div>
    </article>
  );
}

function MiniInfo({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-medium">{value}</p>
    </div>
  );
}
