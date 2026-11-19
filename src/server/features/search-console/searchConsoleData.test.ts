import { describe, expect, it } from "vitest";
import {
  compareRows,
  findCannibalization,
  findDecliners,
} from "./searchConsoleData";

const row = (
  keys: string[],
  clicks: number,
  impressions = 100,
  position = 5,
) => ({ keys, clicks, impressions, ctr: clicks / impressions, position });

describe("findDecliners", () => {
  it("keeps queries that lost more than 20%, biggest loss first", () => {
    const decliners = findDecliners(
      [row(["a"], 70), row(["b"], 90), row(["c"], 5)],
      [row(["a"], 100), row(["b"], 100), row(["c"], 10), row(["gone"], 20)],
    );
    // a lost 30%, gone lost 100%, b only 10%, c had too few clicks before (10 ≥ 5, 50% lost).
    expect(decliners.map((entry) => entry.key)).toEqual(["a", "gone", "c"]);
  });
});

describe("findCannibalization", () => {
  it("needs two pages each holding at least 10% of the impressions", () => {
    const queries = compareRows([row(["shared"], 10), row(["solo"], 10)], []);
    const result = findCannibalization(
      [
        row(["shared", "/a"], 6, 60),
        row(["shared", "/b"], 4, 40),
        row(["solo", "/a"], 9, 95),
        row(["solo", "/b"], 1, 5),
      ],
      queries,
    );
    expect(result.map((entry) => entry.key)).toEqual(["shared"]);
    expect(result[0]?.pages.map((page) => page.page)).toEqual(["/a", "/b"]);
  });

  it("ignores queries with too few impressions to judge", () => {
    expect(
      findCannibalization(
        [row(["rare", "/a"], 1, 20), row(["rare", "/b"], 1, 20)],
        [],
      ),
    ).toEqual([]);
  });
});
