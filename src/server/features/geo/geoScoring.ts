import { sort } from "remeda";
import type { PageAnalysis } from "@/server/lib/audit/types";
import type { BotAccess, JsonLdSummary } from "@/server/features/geo/geoChecks";

/**
 * GEO scoring: per-page citability, the nine categories and the weighted
 * total. Categories that couldn't be measured carry a null score and drop
 * out of the total instead of counting as zero.
 */

const GEO_CATEGORIES = [
  "ai_answers",
  "robots",
  "schema",
  "content",
  "entity",
  "meta",
  "llms_txt",
  "trust",
  "discovery",
] as const;
export type GeoCategoryKey = (typeof GEO_CATEGORIES)[number];

const GEO_CATEGORY_LABELS: Record<GeoCategoryKey, string> = {
  ai_answers: "AI answers",
  robots: "robots.txt",
  schema: "Schema",
  content: "Content",
  entity: "Brand / entity",
  meta: "Meta",
  llms_txt: "llms.txt",
  trust: "Trust signals",
  discovery: "AI discovery",
};

/** Weights sum to 100. A category that can't be measured drops out. */
const GEO_CATEGORY_WEIGHTS: Record<GeoCategoryKey, number> = {
  ai_answers: 15,
  robots: 10,
  schema: 15,
  content: 15,
  entity: 10,
  meta: 10,
  llms_txt: 5,
  trust: 10,
  discovery: 10,
};

export type AuditedPage = {
  url: string;
  analysis: PageAnalysis;
  jsonLd: JsonLdSummary;
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

/** A page about one product: its own entity is a Product, or a /products/ URL. */
export function isProductPage(page: AuditedPage) {
  return (
    page.jsonLd.topTypes.some((type) =>
      ["Product", "ProductGroup"].includes(type),
    ) || /\/products?\//.test(new URL(page.url).pathname)
  );
}

function firstParagraphWords(text: string) {
  const first = text.split(/\n\s*\n|(?<=[.!?])\s{2,}/)[0] ?? "";
  return first.split(/\s+/).filter(Boolean).length;
}

export type PageCitability = { url: string; score: number; gap: string };

/**
 * How easily an AI answer can quote a page: enough text, a clear heading,
 * a direct opening, structure, and facts in markup rather than images.
 * Returns the score and the single biggest gap to fix.
 */
export function scoreCitability(page: AuditedPage): PageCitability {
  const { analysis, jsonLd } = page;
  const gaps: Array<{ points: number; gap: string }> = [];
  let score = 100;
  const lose = (points: number, gap: string) => {
    score -= points;
    gaps.push({ points, gap });
  };
  if (analysis.wordCount < 150)
    lose(35, "Very little text an answer could quote");
  else if (analysis.wordCount < 400)
    lose(15, "Short page; add facts and explanations");
  if (analysis.h1s.length === 0) lose(15, "No H1 heading");
  if (analysis.headingOrder.filter((level) => level === 2).length < 2)
    lose(10, "Few subheadings to structure the answer");
  const opening = firstParagraphWords(analysis.bodyText);
  if (opening > 80) lose(10, "No short, direct answer at the top");
  if (!analysis.hasStructuredData) lose(15, "No structured data");
  else if (isProductPage(page) && !jsonLd.hasOffers)
    lose(10, "Product schema without price and availability");
  if (isProductPage(page) && !jsonLd.hasFaq)
    lose(5, "No FAQ for common product questions");
  if (analysis.javascriptShell)
    lose(20, "Content only appears with JavaScript");
  const imagesWithoutAlt = analysis.images.filter(
    (image) => !image.alt?.trim(),
  );
  if (
    analysis.images.length > 0 &&
    imagesWithoutAlt.length / analysis.images.length > 0.5
  )
    lose(5, "Most images have no alt text");
  const biggest = sort(gaps, (a, b) => b.points - a.points)[0];
  return {
    url: page.url,
    score: clamp(score),
    gap: biggest?.gap ?? "Good; add a source or study to back key claims",
  };
}

export type GeoCategoryResult = {
  key: GeoCategoryKey;
  label: string;
  weight: number;
  /** Null when this audit could not measure it. */
  score: number | null;
  note: string;
};

type CategoryInput = {
  origin: string;
  pages: AuditedPage[];
  bots: BotAccess[];
  robotsText: string | null;
  llmsText: string | null;
  sitemapFound: boolean;
  /** Share of tracked AI answers that mention the brand, 0–1; null if untracked. */
  aiMentionRate: number | null;
  aiAnswerCount: number;
};

function category(
  key: GeoCategoryKey,
  score: number | null,
  note: string,
): GeoCategoryResult {
  return {
    key,
    label: GEO_CATEGORY_LABELS[key],
    weight: GEO_CATEGORY_WEIGHTS[key],
    score: score === null ? null : clamp(score),
    note,
  };
}

export function scoreCategories(input: CategoryInput): GeoCategoryResult[] {
  const { pages, bots } = input;
  const home = pages[0];
  const searchBots = bots.filter((bot) => bot.kind === "search");
  const blockedSearch = searchBots.filter((bot) => bot.status !== "allowed");
  // A bot shut out of part of the site counts half.
  const searchAccess = searchBots.reduce(
    (sum, bot) =>
      sum + (bot.status === "allowed" ? 1 : bot.status === "partial" ? 0.5 : 0),
    0,
  );
  const blockedTraining = bots.filter(
    (bot) => bot.kind === "training" && bot.status === "blocked",
  );

  const productPages = pages.filter(isProductPage);
  const schemaChecks = [
    pages.filter((page) => page.analysis.hasStructuredData).length /
      Math.max(pages.length, 1),
    home?.jsonLd.types.some((type) =>
      [
        "Organization",
        "OnlineStore",
        "Store",
        "Corporation",
        "WebSite",
      ].includes(type),
    )
      ? 1
      : 0,
    ...(productPages.length > 0
      ? [
          productPages.filter((page) => page.jsonLd.hasOffers).length /
            productPages.length,
          productPages.filter((page) => page.jsonLd.hasAggregateRating).length /
            productPages.length,
          productPages.filter(
            (page) => page.jsonLd.hasGtin && page.jsonLd.hasBrand,
          ).length / productPages.length,
        ]
      : []),
  ];
  const schemaScore =
    (schemaChecks.reduce((sum, value) => sum + value, 0) /
      schemaChecks.length) *
    100;
  const schemaNote = productPages.some(
    (page) => !page.jsonLd.hasAggregateRating,
  )
    ? "Product schema without aggregateRating"
    : productPages.some((page) => !page.jsonLd.hasGtin)
      ? "Product schema without GTIN or brand"
      : pages.some((page) => !page.analysis.hasStructuredData)
        ? `${pages.filter((page) => !page.analysis.hasStructuredData).length} pages without structured data`
        : "Structured data on every checked page";

  const citability = pages.map(scoreCitability);
  const contentScore =
    citability.reduce((sum, page) => sum + page.score, 0) /
    Math.max(citability.length, 1);
  const directAnswers = pages.filter(
    (page) => firstParagraphWords(page.analysis.bodyText) <= 80,
  ).length;

  const sameAs = new Set(pages.flatMap((page) => page.jsonLd.sameAs));
  const orgNamed = pages.some((page) => page.jsonLd.organizationName);
  const entityScore =
    (orgNamed ? 40 : 0) +
    Math.min(sameAs.size, 3) * 15 +
    (pages.some((page) => page.jsonLd.logo) ? 15 : 0);

  const titles = pages
    .map((page) => page.analysis.title.trim())
    .filter(Boolean);
  const descriptions = pages
    .map((page) => page.analysis.metaDescription.trim())
    .filter(Boolean);
  const duplicateDescriptions =
    descriptions.length - new Set(descriptions).size;
  const missingDescriptions = pages.length - descriptions.length;
  const missingTitles = pages.length - titles.length;
  const missingOg = pages.filter((page) => !page.analysis.ogTitle).length;
  const metaScore =
    100 -
    ((missingTitles * 100) / Math.max(pages.length, 1)) * 0.4 -
    ((missingDescriptions * 100) / Math.max(pages.length, 1)) * 0.3 -
    ((duplicateDescriptions * 100) / Math.max(pages.length, 1)) * 0.2 -
    ((missingOg * 100) / Math.max(pages.length, 1)) * 0.1;

  const llmsLinks =
    input.llmsText?.match(/\]\(https?:\/\/[^)]+\)/g)?.length ?? 0;
  const llmsScore = input.llmsText
    ? (input.llmsText.trimStart().startsWith("# ") ? 40 : 20) +
      (input.llmsText.includes("\n> ") || input.llmsText.startsWith("> ")
        ? 20
        : 0) +
      Math.min(llmsLinks, 5) * 8
    : 0;

  const trustPages = [
    "about",
    "over-ons",
    "contact",
    "shipping",
    "verzend",
    "return",
    "retour",
    "faq",
    "refund",
    "policies",
  ];
  const linkedPaths = new Set(
    (home?.analysis.links ?? []).map((link) => {
      try {
        return new URL(link.targetUrl).pathname.toLowerCase();
      } catch {
        return "";
      }
    }),
  );
  const trustFound = trustPages.filter((slug) =>
    [...linkedPaths].some((path) => path.includes(slug)),
  ).length;
  const trustScore =
    (input.origin.startsWith("https://") ? 30 : 0) +
    Math.min(trustFound, 4) * 12.5 +
    (productPages.some((page) => page.jsonLd.hasAggregateRating) ? 20 : 0);

  const indexable = pages.filter(
    (page) =>
      page.analysis.statusCode < 300 &&
      !/noindex/i.test(page.analysis.robotsMeta ?? ""),
  ).length;
  const robotsListsSitemap = /^\s*sitemap\s*:/im.test(input.robotsText ?? "");
  const hasHreflang = pages.some(
    (page) => page.analysis.hreflangTags.length > 0,
  );
  const canonicals = pages.filter((page) => page.analysis.canonical).length;
  const discoveryScore =
    (input.sitemapFound ? 30 : 0) +
    (robotsListsSitemap ? 15 : 0) +
    (indexable / Math.max(pages.length, 1)) * 30 +
    (canonicals / Math.max(pages.length, 1)) * 15 +
    (hasHreflang ? 10 : 0);

  return [
    category(
      "ai_answers",
      input.aiMentionRate === null ? null : input.aiMentionRate * 100,
      input.aiMentionRate === null
        ? "Not measured: set up Prompt tracking to see AI answers"
        : `Mentioned in ${Math.round(input.aiMentionRate * 100)}% of ${input.aiAnswerCount} tracked AI answers`,
    ),
    category(
      "robots",
      searchBots.length === 0 ? null : (searchAccess / searchBots.length) * 100,
      blockedSearch.length > 0
        ? `${blockedSearch.map((bot) => bot.agent).join(", ")} ${blockedSearch.length === 1 ? "is" : "are"} not fully allowed`
        : blockedTraining.length > 0
          ? `Search bots allowed; ${blockedTraining.map((bot) => bot.agent).join(", ")} blocked for training`
          : "All AI search bots allowed",
    ),
    category("schema", schemaScore, schemaNote),
    category(
      "content",
      contentScore,
      `${directAnswers} of ${pages.length} pages open with a short, direct answer`,
    ),
    category(
      "entity",
      entityScore,
      !orgNamed
        ? "No Organization schema naming the brand"
        : sameAs.size === 0
          ? "No sameAs links to social profiles"
          : `${sameAs.size} sameAs profiles linked`,
    ),
    category(
      "meta",
      metaScore,
      missingDescriptions > 0
        ? `${missingDescriptions} pages without a meta description`
        : duplicateDescriptions > 0
          ? `${duplicateDescriptions} pages with a duplicate meta description`
          : "Titles and descriptions on every checked page",
    ),
    category(
      "llms_txt",
      llmsScore,
      input.llmsText ? `Found, with ${llmsLinks} links` : "File missing",
    ),
    category(
      "trust",
      trustScore,
      `${trustFound} of the usual trust pages (about, contact, shipping, returns) linked from the homepage`,
    ),
    category(
      "discovery",
      discoveryScore,
      !input.sitemapFound
        ? "No sitemap.xml found"
        : !robotsListsSitemap
          ? "robots.txt doesn't point to the sitemap"
          : !hasHreflang
            ? "No hreflang alternates for other languages"
            : "Sitemap, canonicals and hreflang in place",
    ),
  ];
}

/** Weighted mean over the categories that were measured. */
export function totalScore(categories: GeoCategoryResult[]): number {
  const measured = categories.filter((item) => item.score !== null);
  const weight = measured.reduce((sum, item) => sum + item.weight, 0);
  if (weight === 0) return 0;
  return clamp(
    measured.reduce((sum, item) => sum + (item.score ?? 0) * item.weight, 0) /
      weight,
  );
}

export function scoreBand(score: number) {
  if (score >= 80) return "Strong" as const;
  if (score >= 60) return "Fair" as const;
  if (score >= 40) return "Moderate" as const;
  return "Weak" as const;
}
