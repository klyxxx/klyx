export const KLYX_TIME_ZONE = "Europe/Brussels";

function brusselsParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: KLYX_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

export function todayInBrussels(date = new Date()): string {
  const parts = brusselsParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function currentTimeInBrussels(date = new Date()): string {
  const parts = brusselsParts(date);
  return `${parts.hour}:${parts.minute}`;
}

export function timeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})/.exec(value);

  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
}

export function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T12:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

export function isPastBookingStart(
  bookingDate: string,
  startTime: string,
  now = new Date()
): boolean {
  const today = todayInBrussels(now);

  if (bookingDate < today) return true;
  if (bookingDate > today) return false;

  const selectedMinutes = timeToMinutes(startTime);
  const currentMinutes = timeToMinutes(currentTimeInBrussels(now));

  if (selectedMinutes === null || currentMinutes === null) return true;

  return selectedMinutes <= currentMinutes;
}

export function minimumFutureTimeForDate(
  bookingDate: string,
  now = new Date()
): string | undefined {
  if (bookingDate !== todayInBrussels(now)) return undefined;

  const parts = brusselsParts(now);
  const currentMinutes = Number(parts.hour) * 60 + Number(parts.minute);
  const rounded = Math.min(
    23 * 60 + 59,
    Math.ceil((currentMinutes + 1) / 5) * 5
  );

  return `${String(Math.floor(rounded / 60)).padStart(2, "0")}:${String(
    rounded % 60
  ).padStart(2, "0")}`;
}
