import {
  isPastBookingStart,
  isValidCalendarDate,
  timeToMinutes,
  todayInBrussels,
} from "@/lib/brussels-time";

export type BookingTrackingTimingAction =
  | "scheduled"
  | "en_route"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "provider_finished"
  | "client_confirmed";

type BookingTrackingTimingInput = {
  bookingDate: string;
  startTime: string;
  action: BookingTrackingTimingAction;
  now?: Date;
};

const SERVICE_DAY_ACTIONS = new Set<BookingTrackingTimingAction>([
  "en_route",
  "arrived",
  "in_progress",
  "provider_finished",
  "client_confirmed",
]);

const START_REQUIRED_ACTIONS = new Set<BookingTrackingTimingAction>([
  "in_progress",
  "provider_finished",
  "client_confirmed",
]);

export function getBookingTrackingTimingError({
  bookingDate,
  startTime,
  action,
  now = new Date(),
}: BookingTrackingTimingInput): string | null {
  if (
    !isValidCalendarDate(bookingDate) ||
    timeToMinutes(startTime) === null
  ) {
    return "La date ou l’heure de cette réservation est invalide.";
  }

  if (
    SERVICE_DAY_ACTIONS.has(action) &&
    bookingDate > todayInBrussels(now)
  ) {
    return "Le suivi de mission ne peut pas commencer avant le jour prévu.";
  }

  if (
    START_REQUIRED_ACTIONS.has(action) &&
    !isPastBookingStart(bookingDate, startTime, now)
  ) {
    return "La prestation ne peut pas commencer ou être terminée avant l’heure prévue.";
  }

  return null;
}
