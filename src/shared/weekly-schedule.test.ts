import { expect, it } from "vitest";
import { nextWeeklyRun } from "./weekly-schedule";

const monday8 = (from: string) =>
  nextWeeklyRun({
    from: new Date(from),
    weekday: 1,
    time: "08:00",
    timeZone: "Europe/Amsterdam",
  }).toISOString();

it("fires Monday 08:00 Amsterdam in winter and summer time", () => {
  // Thu 19 Nov 2026 (CET, UTC+1) → Mon 23 Nov 07:00 UTC.
  expect(monday8("2026-11-19T16:00:00Z")).toBe("2026-11-23T07:00:00.000Z");
  // Fri 26 Jun 2026 (CEST, UTC+2) → Mon 29 Jun 06:00 UTC.
  expect(monday8("2026-06-26T12:00:00Z")).toBe("2026-06-29T06:00:00.000Z");
  // Across the switch: Fri 23 Oct (CEST) → Mon 26 Oct (CET) 07:00 UTC.
  expect(monday8("2026-10-23T12:00:00Z")).toBe("2026-10-26T07:00:00.000Z");
});

it("moves to the next week once this Monday's run time has passed", () => {
  expect(monday8("2026-11-23T07:00:00Z")).toBe("2026-11-30T07:00:00.000Z");
});
