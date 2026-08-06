export type PlanningBooking = {
  id: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: string;
  serviceStatus: string | null;
  clientName: string;
};

export type PlanningAvailability = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export type PlanningWarning = {
  code:
    | "overlap"
    | "short_break"
    | "long_day"
    | "outside_availability"
    | "pending_near_confirmed";
  severity: "info" | "warning" | "high";
  title: string;
  detail: string;
  bookingIds: string[];
};

export type PlanningDay = {
  date: string;
  totalMinutes: number;
  bookings: PlanningBooking[];
  warnings: PlanningWarning[];
};

function minutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})/.exec(value);

  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return hour * 60 + minute;
}

function dayOfWeek(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

function activeBooking(status: string): boolean {
  return [
    "pending",
    "accepted",
    "completed",
  ].includes(status);
}

function confirmedBooking(status: string): boolean {
  return ["accepted", "completed"].includes(status);
}

export function analyzeProviderPlanning(
  bookings: PlanningBooking[],
  availability: PlanningAvailability[]
): PlanningDay[] {
  const grouped = new Map<string, PlanningBooking[]>();

  for (const booking of bookings) {
    if (!activeBooking(booking.status)) continue;

    const current = grouped.get(booking.bookingDate) ?? [];
    current.push(booking);
    grouped.set(booking.bookingDate, current);
  }

  return [...grouped.entries()]
    .sort(([first], [second]) =>
      first.localeCompare(second)
    )
    .map(([date, dayBookings]) => {
      const ordered = [...dayBookings].sort((first, second) =>
        first.startTime.localeCompare(second.startTime)
      );
      const warnings: PlanningWarning[] = [];
      const weekday = dayOfWeek(date);
      const daySlots = availability.filter(
        (slot) => slot.dayOfWeek === weekday
      );

      let totalMinutes = 0;

      for (const booking of ordered) {
        const start = minutes(booking.startTime);
        const end = minutes(booking.endTime);

        if (
          start !== null &&
          end !== null &&
          end > start &&
          confirmedBooking(booking.status)
        ) {
          totalMinutes += end - start;
        }

        if (
          start !== null &&
          end !== null &&
          daySlots.length > 0
        ) {
          const insideAvailability = daySlots.some((slot) => {
            const slotStart = minutes(slot.startTime);
            const slotEnd = minutes(slot.endTime);

            return (
              slotStart !== null &&
              slotEnd !== null &&
              start >= slotStart &&
              end <= slotEnd
            );
          });

          if (!insideAvailability) {
            warnings.push({
              code: "outside_availability",
              severity: "warning",
              title: "Mission hors disponibilité",
              detail:
                `${booking.startTime.slice(0, 5)}–${booking.endTime.slice(
                  0,
                  5
                )} ne correspond pas aux horaires habituels.`,
              bookingIds: [booking.id],
            });
          }
        }

        if (
          daySlots.length === 0 &&
          confirmedBooking(booking.status)
        ) {
          warnings.push({
            code: "outside_availability",
            severity: "warning",
            title: "Aucune disponibilité habituelle",
            detail:
              "Une mission est prévue un jour normalement désactivé.",
            bookingIds: [booking.id],
          });
        }
      }

      for (let index = 0; index < ordered.length - 1; index += 1) {
        const current = ordered[index];
        const next = ordered[index + 1];
        const currentStart = minutes(current.startTime);
        const currentEnd = minutes(current.endTime);
        const nextStart = minutes(next.startTime);
        const nextEnd = minutes(next.endTime);

        if (
          currentStart === null ||
          currentEnd === null ||
          nextStart === null ||
          nextEnd === null
        ) {
          continue;
        }

        if (
          confirmedBooking(current.status) &&
          confirmedBooking(next.status) &&
          nextStart < currentEnd
        ) {
          warnings.push({
            code: "overlap",
            severity: "high",
            title: "Chevauchement détecté",
            detail:
              `${current.startTime.slice(0, 5)}–${current.endTime.slice(
                0,
                5
              )} chevauche ${next.startTime.slice(0, 5)}–${next.endTime.slice(
                0,
                5
              )}.`,
            bookingIds: [current.id, next.id],
          });

          continue;
        }

        const breakMinutes = nextStart - currentEnd;

        if (
          confirmedBooking(current.status) &&
          confirmedBooking(next.status) &&
          breakMinutes >= 0 &&
          breakMinutes < 30
        ) {
          warnings.push({
            code: "short_break",
            severity: "warning",
            title: "Pause très courte",
            detail:
              `Seulement ${breakMinutes} minute(s) entre deux missions. Prévois le déplacement.`,
            bookingIds: [current.id, next.id],
          });
        }

        if (
          current.status === "accepted" &&
          next.status === "pending" &&
          nextStart < currentEnd + 30
        ) {
          warnings.push({
            code: "pending_near_confirmed",
            severity: "info",
            title: "Demande proche d’une mission confirmée",
            detail:
              "Vérifie le temps de déplacement avant d’accepter cette demande.",
            bookingIds: [current.id, next.id],
          });
        }
      }

      if (totalMinutes > 8 * 60) {
        warnings.push({
          code: "long_day",
          severity: "warning",
          title: "Journée très chargée",
          detail:
            `${Math.floor(totalMinutes / 60)} h ${
              totalMinutes % 60
            } min de missions confirmées.`,
          bookingIds: ordered
            .filter((booking) =>
              confirmedBooking(booking.status)
            )
            .map((booking) => booking.id),
        });
      }

      return {
        date,
        totalMinutes,
        bookings: ordered,
        warnings,
      };
    });
}
