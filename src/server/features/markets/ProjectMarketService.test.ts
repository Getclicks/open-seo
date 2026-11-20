import { beforeEach, expect, it, vi } from "vitest";
import { ProjectMarketService } from "./ProjectMarketService";

const mocks = vi.hoisted(() => ({ listForProjects: vi.fn() }));

vi.mock("@/server/features/markets/ProjectMarketRepository", () => ({
  ProjectMarketRepository: {
    listForProjects: mocks.listForProjects,
    insert: vi.fn(),
    remove: vi.fn(),
  },
}));

const project = { id: "p1", locationCode: 2528, languageCode: "nl" };

beforeEach(() => {
  mocks.listForProjects.mockResolvedValue([]);
});

it("gives a store without extra markets just its primary market", async () => {
  await expect(ProjectMarketService.list(project)).resolves.toEqual([
    { locationCode: 2528, languageCode: "nl", primary: true },
  ]);
});

it("lists extra markets after the primary one, never repeating it", async () => {
  mocks.listForProjects.mockResolvedValue([
    { projectId: "p1", locationCode: 2528, languageCode: "nl" },
    { projectId: "p1", locationCode: 2056, languageCode: "fr" },
  ]);
  await expect(ProjectMarketService.list(project)).resolves.toEqual([
    { locationCode: 2528, languageCode: "nl", primary: true },
    { locationCode: 2056, languageCode: "fr", primary: false },
  ]);
});
