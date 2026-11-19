import {
  Bot,
  FileText,
  LayoutGrid,
  Search,
  Sparkles,
  Tag,
  Wrench,
} from "lucide-react";
import { linkOptions, type LinkOptions } from "@tanstack/react-router";
import type { ComponentType } from "react";
import type { SearchConsoleTab } from "@/shared/search-console";

type NavIcon = ComponentType<{ className?: string }>;

export type NavSubItem = {
  label: string;
  link: LinkOptions;
  /** Search params that must match for this entry to be the active one. */
  matchSearch?: Record<string, string>;
};

export type NavModule = {
  key: string;
  label: string;
  icon: NavIcon;
  link: LinkOptions;
  /** Paths (route ids under /p/$projectId) that belong to this module. */
  paths: string[];
  subs: NavSubItem[];
};

// Project-independent; shown on its own when no project is selected.
const aiNavItem = linkOptions({ to: "/ai" as const });

export const connectNavModules: NavModule[] = [
  {
    key: "agent",
    label: "Agent setup",
    icon: Bot,
    link: aiNavItem,
    paths: [],
    subs: [],
  },
];

/**
 * The SEO App navigation: five modules, each with its own sub-pages shown
 * while the module is active, plus the remaining OpenSEO tools.
 */
export function getProjectNavModules(projectId: string): NavModule[] {
  const params = { projectId };
  const searchConsoleTab = (
    tab: SearchConsoleTab,
    label: string,
  ): NavSubItem => ({
    label,
    link: linkOptions({
      to: "/p/$projectId/search-console",
      params,
      search: { tab },
    }),
    matchSearch: { tab },
  });
  return [
    {
      key: "dashboard",
      label: "Dashboard",
      icon: LayoutGrid,
      link: linkOptions({ to: "/p/$projectId", params, search: {} }),
      paths: ["/p/$projectId/"],
      subs: [],
    },
    {
      key: "search-console",
      label: "Search Console",
      icon: Search,
      link: linkOptions({
        to: "/p/$projectId/search-console",
        params,
        search: {},
      }),
      paths: [
        "/p/$projectId/search-console",
        "/p/$projectId/search-performance",
      ],
      subs: [
        searchConsoleTab("queries", "Queries"),
        searchConsoleTab("pages", "Pages"),
        searchConsoleTab("opportunities", "Opportunities"),
        searchConsoleTab("decliners", "Decliners"),
        searchConsoleTab("cannibalization", "Cannibalization"),
        searchConsoleTab("indexing", "Indexing"),
        {
          label: "Explorer",
          link: linkOptions({
            to: "/p/$projectId/search-performance",
            params,
            search: {},
          }),
        },
      ],
    },
    {
      key: "geo",
      label: "GEO / AI visibility",
      icon: Sparkles,
      link: linkOptions({ to: "/p/$projectId/geo", params, search: {} }),
      paths: [
        "/p/$projectId/geo",
        "/p/$projectId/ai-visibility",
        "/p/$projectId/prompt-explorer",
      ],
      subs: [
        {
          label: "GEO score",
          link: linkOptions({ to: "/p/$projectId/geo", params, search: {} }),
        },
        {
          label: "Prompt tracking",
          link: linkOptions({
            to: "/p/$projectId/ai-visibility",
            params,
            search: {},
          }),
        },
        {
          label: "Prompt research",
          link: linkOptions({
            to: "/p/$projectId/ai-visibility/research",
            params,
            search: {},
          }),
        },
        {
          label: "Prompt explorer",
          link: linkOptions({
            to: "/p/$projectId/prompt-explorer",
            params,
            search: {},
          }),
        },
      ],
    },
    {
      key: "keywords",
      label: "Keywords",
      icon: Tag,
      link: linkOptions({ to: "/p/$projectId/keywords", params, search: {} }),
      paths: [
        "/p/$projectId/keywords",
        "/p/$projectId/questions",
        "/p/$projectId/saved",
        "/p/$projectId/rank-tracking",
        "/p/$projectId/domain",
        "/p/$projectId/backlinks",
      ],
      subs: [
        {
          label: "Ideas",
          link: linkOptions({
            to: "/p/$projectId/keywords",
            params,
            search: {},
          }),
        },
        {
          label: "Questions",
          link: linkOptions({
            to: "/p/$projectId/questions",
            params,
            search: {},
          }),
        },
        {
          label: "Saved keywords",
          link: linkOptions({ to: "/p/$projectId/saved", params, search: {} }),
        },
        {
          label: "Rank tracking",
          link: linkOptions({
            to: "/p/$projectId/rank-tracking",
            params,
            search: {},
          }),
        },
        {
          label: "Competitors",
          link: linkOptions({
            to: "/p/$projectId/domain",
            params,
            search: {},
          }),
        },
        {
          label: "Backlinks",
          link: linkOptions({
            to: "/p/$projectId/backlinks",
            params,
            search: {},
          }),
        },
      ],
    },
    {
      key: "weekly-reports",
      label: "Weekly reports",
      icon: FileText,
      link: linkOptions({
        to: "/p/$projectId/weekly-reports",
        params,
        search: {},
      }),
      paths: ["/p/$projectId/weekly-reports"],
      subs: [],
    },
    {
      key: "tools",
      label: "More tools",
      icon: Wrench,
      link: linkOptions({ to: "/p/$projectId/audit", params, search: {} }),
      paths: [
        "/p/$projectId/audit",
        "/p/$projectId/local-seo",
        "/p/$projectId/reports",
        "/p/$projectId/context",
        "/ai",
      ],
      subs: [
        {
          label: "Site audit",
          link: linkOptions({ to: "/p/$projectId/audit", params, search: {} }),
        },
        {
          label: "Local SEO",
          link: linkOptions({
            to: "/p/$projectId/local-seo",
            params,
            search: {},
          }),
        },
        {
          label: "Shareable reports",
          link: linkOptions({
            to: "/p/$projectId/reports",
            params,
            search: {},
          }),
        },
        {
          label: "Context",
          link: linkOptions({
            to: "/p/$projectId/context",
            params,
            search: {},
          }),
        },
        { label: "Agent setup", link: aiNavItem },
      ],
    },
  ];
}

/**
 * The module the current page belongs to, from the matched route ids. The
 * dashboard (the project index route) only owns the page when nothing deeper
 * matched.
 */
export function findActiveModule(
  modules: NavModule[],
  routeIds: string[],
): NavModule | null {
  const deepest = routeIds.at(-1) ?? "";
  return (
    modules.find((module) =>
      module.key === "dashboard"
        ? deepest === "/_app/p/$projectId/"
        : module.paths.some((path) =>
            routeIds.some(
              (id) => id === `/_app${path}` || id.startsWith(`/_app${path}/`),
            ),
          ),
    ) ?? null
  );
}

export const dataforseoHelpLinkOptions = linkOptions({
  to: "/help/dataforseo-api-key",
});
