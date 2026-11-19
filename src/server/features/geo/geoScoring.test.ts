import { expect, it } from "vitest";
import { totalScore, type GeoCategoryResult } from "./geoScoring";

const category = (
  key: GeoCategoryResult["key"],
  weight: number,
  score: number | null,
): GeoCategoryResult => ({ key, label: key, weight, score, note: "" });

it("leaves unmeasured categories out of the total instead of scoring 0", () => {
  expect(
    totalScore([
      category("ai_answers", 15, null),
      category("robots", 10, 100),
      category("llms_txt", 5, 40),
    ]),
  ).toBe(80);
});
