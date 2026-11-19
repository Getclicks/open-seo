/**
 * The next time a weekly schedule fires: `weekday` (0 = Sunday) at `time`
 * (HH:MM) in `timeZone`, strictly after `from`. DST-safe: the local wall
 * time is converted with the zone's offset on that day.
 */
export function nextWeeklyRun(input: {
  from: Date;
  weekday: number;
  time: string;
  timeZone: string;
}): Date {
  const [hour, minute] = input.time.split(":").map(Number);
  for (let offset = 0; offset <= 7; offset++) {
    const day = new Date(input.from.getTime() + offset * 86_400_000);
    const local = localParts(day, input.timeZone);
    if (local.weekday !== input.weekday) continue;
    const candidate = zonedTimeToUtc(
      { ...local, hour: hour ?? 8, minute: minute ?? 0 },
      input.timeZone,
    );
    if (candidate.getTime() > input.from.getTime()) return candidate;
  }
  // The same weekday a week later (the first match was already past).
  return nextWeeklyRun({
    ...input,
    from: new Date(input.from.getTime() + 86_400_000),
  });
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function localParts(date: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: WEEKDAYS.indexOf(String(parts.weekday)),
  };
}

function zonedTimeToUtc(
  wall: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
  },
  timeZone: string,
) {
  const { year, month, day, hour, minute } = wall;
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const local = localParts(new Date(guess), timeZone);
  const asUtc = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
  );
  return new Date(guess - (asUtc - guess));
}

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
