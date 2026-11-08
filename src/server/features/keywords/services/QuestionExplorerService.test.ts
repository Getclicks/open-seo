import { beforeEach, expect, it, vi } from "vitest";
import { QuestionExplorerService } from "./QuestionExplorerService";

const mocks = vi.hoisted(() => ({
  autocompleteBatch: vi.fn(),
}));

vi.mock("@/server/lib/dataforseo", () => ({
  createDataforseoClient: () => ({
    serp: { autocompleteBatch: mocks.autocompleteBatch },
  }),
  fetchKeywordMetricsForList: vi.fn(),
}));

const customer = {
  organizationId: "org_1",
  userId: "user_1",
  userEmail: "user@example.com",
};

beforeEach(() => {
  mocks.autocompleteBatch.mockImplementation(
    async (inputs: Array<{ keyword: string }>) =>
      inputs.map((input) => {
        if (input.keyword === "hoe rugpijn")
          return {
            status: "fulfilled",
            value: [
              "hoe rugpijn verhelpen",
              // Drifted off the seed keyword.
              "hoe laat is het",
            ],
          };
        if (input.keyword === "wat rugpijn")
          // Already listed under "hoe".
          return { status: "fulfilled", value: ["Hoe rugpijn verhelpen"] };
        if (input.keyword === "rugpijn voor")
          return { status: "fulfilled", value: ["rugpijn voor in de borst"] };
        return { status: "fulfilled", value: [] };
      }),
  );
});

it("groups on-topic suggestions by modifier, once each", async () => {
  const result = await QuestionExplorerService.explore(
    {
      keyword: "Rugpijn",
      locationCode: 2528,
      languageCode: "nl",
      includeAlphabetical: false,
      includeVolumes: false,
    },
    customer,
  );

  expect(result.groups).toEqual([
    {
      id: "questions",
      modifiers: [
        {
          modifier: "hoe",
          suggestions: [
            { keyword: "hoe rugpijn verhelpen", searchVolume: null, cpc: null },
          ],
        },
      ],
    },
    {
      id: "prepositions",
      modifiers: [
        {
          modifier: "voor",
          suggestions: [
            {
              keyword: "rugpijn voor in de borst",
              searchVolume: null,
              cpc: null,
            },
          ],
        },
      ],
    },
  ]);
  expect(result.totalSuggestions).toBe(2);
});

it("rejects languages it has no modifiers for before spending anything", async () => {
  await expect(
    QuestionExplorerService.explore(
      {
        keyword: "dolor de espalda",
        locationCode: 2724,
        languageCode: "es",
        includeAlphabetical: false,
        includeVolumes: false,
      },
      customer,
    ),
  ).rejects.toThrow("Question Explorer supports");
  expect(mocks.autocompleteBatch).not.toHaveBeenCalled();
});
