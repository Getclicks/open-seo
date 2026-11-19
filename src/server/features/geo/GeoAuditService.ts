import { sort, reverse } from "remeda";
import { ProjectRepository } from "@/server/features/projects/repositories/ProjectRepository";
import { GscConnectionRepository } from "@/server/features/gsc/repositories/GscConnectionRepository";
import { SearchConsoleService } from "@/server/features/search-console/SearchConsoleService";
import { loadAiTrend } from "@/server/features/ai-visibility/services/aiVisibilityTrend";
import { publicFetch } from "@/server/lib/public-fetch";
import { readBoundedText, discoverSiteUrls } from "@/server/lib/scrape";
import { normalizeAndValidateStartUrl } from "@/server/lib/audit/url-policy";
import { analyzeHtml } from "@/server/lib/audit/page-analyzer";
import { AppError } from "@/server/lib/errors";
import {
  checkBotAccess,
  isPlainTextFile,
  isSitemapXml,
  summarizeJsonLd,
  type BotAccess,
} from "@/server/features/geo/geoChecks";
import {
  scoreBand,
  scoreCategories,
  scoreCitability,
  totalScore,
  type AuditedPage,
  type GeoCategoryResult,
  type PageCitability,
} from "@/server/features/geo/geoScoring";
import { buildGeoFixes, type GeoFix } from "@/server/features/geo/geoFixes";
import { GeoAuditRepository } from "@/server/features/geo/GeoAuditRepository";

const MAX_PAGES = 10;
const FETCH_TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 4;
const USER_AGENT = "OpenSEO-GEO/1.0 (+https://openseo.so)";

export type GeoAuditResult = {
  origin: string;
  score: number;
  band: ReturnType<typeof scoreBand>;
  categories: GeoCategoryResult[];
  bots: BotAccess[];
  pages: PageCitability[];
  fixes: GeoFix[];
  /** Pages the audit tried but couldn't read. */
  unreadable: string[];
};

/** GET following redirects by hand, re-validating every hop. */
async function fetchFollowing(
  url: string,
  accept: string,
): Promise<{
  status: number;
  finalUrl: string;
  contentType: string | null;
  body: string | null;
} | null> {
  let current: string;
  try {
    current = await normalizeAndValidateStartUrl(url);
  } catch {
    return null;
  }
  const started = Date.now();
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let response: Response;
    try {
      response = await publicFetch(current, {
        headers: { "user-agent": USER_AGENT, accept },
        redirect: "manual",
        signal: AbortSignal.timeout(
          Math.max(1, FETCH_TIMEOUT_MS - (Date.now() - started)),
        ),
      });
    } catch {
      return null;
    }
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel();
      try {
        current = await normalizeAndValidateStartUrl(
          new URL(location, current).toString(),
        );
      } catch {
        return null;
      }
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      return {
        status: response.status,
        finalUrl: current,
        contentType: null,
        body: null,
      };
    }
    return {
      status: response.status,
      finalUrl: current,
      contentType: response.headers.get("content-type"),
      body: await readBoundedText(response),
    };
  }
  return null;
}

async function fetchTextFile(url: string) {
  const result = await fetchFollowing(url, "text/plain,*/*");
  if (!result?.body) return null;
  // A shop's "not found" page served with 200 is not a text file.
  return isPlainTextFile(result.body, result.contentType) ? result.body : null;
}

/** /sitemap.xml, else the first sitemap robots.txt names. */
async function findSitemap(origin: string, robotsText: string | null) {
  const listed = [...(robotsText ?? "").matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)]
    .map((match) => match[1])
    .filter((url): url is string => Boolean(url));
  for (const url of [`${origin}/sitemap.xml`, ...listed.slice(0, 2)]) {
    const result = await fetchFollowing(url, "application/xml,text/xml,*/*");
    if (result?.body && isSitemapXml(result.body)) return true;
  }
  return false;
}

async function readPage(url: string): Promise<AuditedPage | null> {
  const started = Date.now();
  const result = await fetchFollowing(url, "text/html,*/*");
  if (!result?.body) return null;
  const analysis = analyzeHtml(
    result.body,
    result.finalUrl,
    result.status,
    Date.now() - started,
    result.finalUrl === url ? null : result.finalUrl,
  );
  return {
    url: result.finalUrl,
    analysis,
    jsonLd: summarizeJsonLd(result.body),
  };
}

/** The pages worth auditing: the homepage, then the ones Google shows most. */
async function pickPages(projectId: string, origin: string) {
  const urls = new Set<string>([`${origin}/`]);
  if (await GscConnectionRepository.getByProjectId(projectId)) {
    try {
      const overview = await SearchConsoleService.getOverview({
        projectId,
        days: 28,
      });
      for (const page of sort(
        [...overview.pages],
        (a, b) => b.impressions - a.impressions,
      )) {
        if (urls.size >= MAX_PAGES) break;
        if (page.key.startsWith(origin)) urls.add(page.key);
      }
    } catch {
      // Fall back to the sitemap below.
    }
  }
  if (urls.size < MAX_PAGES) {
    const discovered = await discoverSiteUrls(origin, MAX_PAGES * 3);
    // Spread across sections instead of the sitemap's first ten products.
    const bySection = new Map<string, string[]>();
    for (const url of discovered.urls) {
      const section = new URL(url).pathname.split("/")[1] ?? "";
      bySection.set(section, [...(bySection.get(section) ?? []), url]);
    }
    const queues = [...bySection.values()];
    while (urls.size < MAX_PAGES && queues.some((queue) => queue.length > 0)) {
      for (const queue of queues) {
        const next = queue.shift();
        if (next && urls.size < MAX_PAGES) urls.add(next);
      }
    }
  }
  return [...urls];
}

async function aiMentions(projectId: string) {
  try {
    const trend = await loadAiTrend({ projectId, days: 28 });
    const answers = trend.runs.reduce(
      (sum, entry) => sum + entry.coverage.answered,
      0,
    );
    return { rate: answers > 0 ? trend.mentions.current : null, answers };
  } catch {
    return { rate: null, answers: 0 };
  }
}

async function run(input: {
  projectId: string;
  trigger: "manual" | "scheduled";
}) {
  const project = await ProjectRepository.getProjectById(input.projectId);
  if (!project?.domain) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Add the store's domain in its settings before running a GEO audit.",
    );
  }
  let origin: string;
  try {
    origin = new URL(await normalizeAndValidateStartUrl(project.domain)).origin;
  } catch {
    throw new AppError(
      "VALIDATION_ERROR",
      "The store's domain can't be reached.",
    );
  }

  const robotsText = await fetchTextFile(`${origin}/robots.txt`);
  const [llmsText, sitemapFound, urls, mentions] = await Promise.all([
    fetchTextFile(`${origin}/llms.txt`),
    findSitemap(origin, robotsText),
    pickPages(input.projectId, origin),
    aiMentions(input.projectId),
  ]);

  const read = await Promise.all(urls.map(readPage));
  const pages = read.filter((page): page is AuditedPage => page !== null);
  if (pages.length === 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "The audit couldn't read any page of the store. Check that the domain is online.",
    );
  }
  const bots = checkBotAccess(
    robotsText,
    pages.slice(1).map((page) => page.url),
  );
  const categories = scoreCategories({
    origin,
    pages,
    bots,
    robotsText,
    llmsText,
    sitemapFound,
    aiMentionRate: mentions.rate,
    aiAnswerCount: mentions.answers,
  });
  const score = totalScore(categories);
  const brand = project.brandName ?? project.name;
  const result: GeoAuditResult = {
    origin,
    score,
    band: scoreBand(score),
    categories,
    bots,
    pages: sort(pages.map(scoreCitability), (a, b) => b.score - a.score),
    fixes: buildGeoFixes({
      brand,
      origin,
      pages,
      bots,
      description: pages[0]?.analysis.metaDescription.trim() || null,
    }),
    unreadable: urls.filter(
      (url) =>
        !pages.some((page) => page.url === url || page.url === `${url}/`),
    ),
  };
  const saved = await GeoAuditRepository.insert({
    projectId: input.projectId,
    trigger: input.trigger,
    score,
    result: JSON.stringify(result),
  });
  return { id: saved.id, createdAt: saved.createdAt, ...result };
}

function parse(row: { id: string; createdAt: string; result: string }) {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- written by run() above
  const result = JSON.parse(row.result) as GeoAuditResult;
  return { id: row.id, createdAt: row.createdAt, ...result };
}

/** The audit to show (the latest, or one picked from history) and the score history. */
async function get(input: { projectId: string; auditId?: string }) {
  const [row, history] = await Promise.all([
    input.auditId
      ? GeoAuditRepository.getForProject(input.projectId, input.auditId)
      : GeoAuditRepository.getLatest(input.projectId),
    GeoAuditRepository.listForProject(input.projectId, 12),
  ]);
  return {
    audit: row ? parse(row) : null,
    history: reverse(history),
  };
}

export type GeoAuditView = NonNullable<
  Awaited<ReturnType<typeof get>>["audit"]
>;

export const GeoAuditService = { run, get } as const;
