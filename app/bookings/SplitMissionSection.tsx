import Link from "next/link";

import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Layers3,
  UserRound,
  UsersRound,
} from "lucide-react";

// KLYX_SPLIT_MISSION_UI_13_21

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
  slotId:
    string;

  position:
    number;

  date:
    string;

  startTime:
    string;

  endTime:
    string;

  budgetMax:
    number | null;

  providerId:
    string;

  providerName:
    string;

  providerAvatar:
    string | null;

  bookingId:
    string | null;

  bookingStatus:
    string;

  serviceStatus:
    string;
};

export type SplitMissionSummary = {
  id:
    string;

  batchId:
    string;

  marketRequestId:
    string;

  confirmationId:
    string;

  status:
    SplitMissionState;

  batchStatus:
    string;

  serviceId:
    string | null;

  serviceName:
    string;

  serviceSlug:
    string | null;

  slotCount:
    number;

  createdBookingCount:
    number;

  providerCount:
    number;

  firstDate:
    string | null;

  lastDate:
    string | null;

  createdAt:
    string;

  failureReason:
    string | null;

  actionRequired:
    boolean;

  slots:
    SplitMissionSlot[];

  childBookingIds:
    string[];
};

export type SplitMissionFilter =
  | "actions"
  | "upcoming"
  | "history"
  | "all";

const LABELS:
  Record<
    SplitMissionState,
    string
  > = {
  creating:
    "Création en cours",

  recovery_required:
    "Vérification requise",

  awaiting_providers:
    "En attente des prestataires",

  partially_accepted:
    "Acceptation partielle",

  confirmed:
    "Confirmée",

  in_progress:
    "En cours",

  completed:
    "Terminée",

  cancelled:
    "Annulée",

  mixed_issue:
    "Action requise",
};

function formatDate(
  value:
    string | null
): string {
  if (
    !value
  ) {
    return "Date à confirmer";
  }

  return new Intl.DateTimeFormat(
    "fr-BE",
    {
      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric",
    }
  ).format(
    new Date(
      value +
      "T12:00:00"
    )
  );
}

export function splitMissionNeedsAction(
  mission:
    SplitMissionSummary
): boolean {
  return (
    mission.status ===
      "recovery_required" ||
    mission.status ===
      "mixed_issue"
  );
}

export function splitMissionIsHistory(
  mission:
    SplitMissionSummary
): boolean {
  return (
    mission.status ===
      "completed" ||
    mission.status ===
      "cancelled"
  );
}

export function splitMissionMatchesFilter(
  mission:
    SplitMissionSummary,

  filter:
    SplitMissionFilter
): boolean {
  if (
    filter ===
    "actions"
  ) {
    return splitMissionNeedsAction(
      mission
    );
  }

  if (
    filter ===
    "upcoming"
  ) {
    return !splitMissionIsHistory(
      mission
    );
  }

  if (
    filter ===
    "history"
  ) {
    return splitMissionIsHistory(
      mission
    );
  }

  return true;
}

export default function SplitMissionSection({
  missions,
  filter,
}: {
  missions:
    SplitMissionSummary[];

  filter:
    SplitMissionFilter;
}) {
  const visible =
    missions.filter(
      (
        mission
      ) =>
        splitMissionMatchesFilter(
          mission,
          filter
        )
    );

  if (
    visible.length ===
    0
  ) {
    return null;
  }

  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-500/10 text-violet-500">
          <Layers3
            size={20}
          />
        </span>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-500">
            Missions KLYX
          </p>

          <h2 className="font-black">
            Missions multi-prestataires
          </h2>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {visible.map(
          (
            mission
          ) => {
            const danger =
              mission.status ===
                "recovery_required" ||
              mission.status ===
                "mixed_issue";

            return (
              <article
                key={
                  mission.id
                }
                className={
                  danger
                    ? "rounded-3xl border border-rose-500/30 bg-rose-500/5 p-6"
                    : "rounded-3xl border border-border bg-card p-6 dark:bg-zinc-900"
                }
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-black">
                      {mission.serviceName}
                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Une mission ·{" "}
                      {mission.slotCount}{" "}
                      créneaux
                    </p>
                  </div>

                  <span
                    className={
                      danger
                        ? "rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-black text-rose-600"
                        : "rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-xs font-black text-violet-500"
                    }
                  >
                    {LABELS[
                      mission.status
                    ]}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-background/60 p-4">
                    <p className="flex items-center gap-2 text-xs font-black text-muted-foreground">
                      <UsersRound
                        size={15}
                      />
                      Prestataires
                    </p>

                    <p className="mt-2 text-xl font-black">
                      {mission.providerCount}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border bg-background/60 p-4">
                    <p className="flex items-center gap-2 text-xs font-black text-muted-foreground">
                      <CalendarDays
                        size={15}
                      />
                      Période
                    </p>

                    <p className="mt-2 text-sm font-black">
                      {formatDate(
                        mission.firstDate
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-2">
                  {mission.slots
                    .slice(
                      0,
                      3
                    )
                    .map(
                      (
                        slot
                      ) => (
                        <div
                          key={
                            slot.slotId
                          }
                          className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background/50 px-4 py-3"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-muted">
                              {slot.providerAvatar ? (
                                <img
                                  src={
                                    slot.providerAvatar
                                  }
                                  alt={
                                    slot.providerName
                                  }
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <UserRound
                                  size={17}
                                />
                              )}
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-sm font-black">
                                {slot.providerName}
                              </p>

                              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock3
                                  size={12}
                                />

                                {slot.startTime.slice(
                                  0,
                                  5
                                )}
                                {" – "}
                                {slot.endTime.slice(
                                  0,
                                  5
                                )}
                              </p>
                            </div>
                          </div>

                          <p className="shrink-0 text-xs font-black">
                            {formatDate(
                              slot.date
                            )}
                          </p>
                        </div>
                      )
                    )}
                </div>

                {mission.slots.length >
                  3 && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    +{" "}
                    {mission.slots.length -
                      3}{" "}
                    autre(s) créneau(x)
                  </p>
                )}

                {danger && (
                  <div className="mt-5 flex gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
                    <AlertTriangle
                      className="shrink-0 text-rose-600"
                      size={18}
                    />

                    <p className="text-sm">
                      KLYX a détecté une mission qui nécessite une vérification.
                    </p>
                  </div>
                )}

                {mission.status ===
                  "completed" && (
                  <div className="mt-5 flex items-center gap-2 text-sm font-black text-emerald-600">
                    <CheckCircle2
                      size={18}
                    />

                    Tous les créneaux sont terminés.
                  </div>
                )}

                <Link
                  href={
                    "/bookings/split/" +
                    mission.batchId
                  }
                  className="mt-5 inline-flex items-center gap-2 font-black text-violet-500"
                >
                  Voir la mission complète

                  <ArrowRight
                    size={17}
                  />
                </Link>

                <p className="mt-4 text-xs leading-5 text-muted-foreground">
                  Les réservations individuelles restent accessibles dans le détail de la mission. Aucun paiement supplémentaire n'est déclenché ici.
                </p>
              </article>
            );
          }
        )}
      </div>
    </section>
  );
}