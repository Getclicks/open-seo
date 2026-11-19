import robotsParser from "robots-parser";

/**
 * Pure GEO (generative engine optimization) checks: which AI crawlers may
 * read the site, what its structured data says, and how easy each page is
 * for an AI answer to quote. Everything here works on fetched text, so the
 * scoring is testable without the network.
 */

export type GeoBot = {
  agent: string;
  role: string;
  /** Search bots fetch pages to answer users; training bots don't. */
  kind: "search" | "training";
};

const GEO_BOTS: GeoBot[] = [
  { agent: "OAI-SearchBot", role: "Search results in ChatGPT", kind: "search" },
  {
    agent: "ChatGPT-User",
    role: "Pages ChatGPT opens for a user",
    kind: "search",
  },
  { agent: "PerplexityBot", role: "Perplexity answers", kind: "search" },
  { agent: "Claude-SearchBot", role: "Search in Claude", kind: "search" },
  {
    agent: "Googlebot",
    role: "Google Search and AI Overviews",
    kind: "search",
  },
  { agent: "Bingbot", role: "Bing and Copilot", kind: "search" },
  { agent: "Applebot", role: "Siri and Spotlight", kind: "search" },
  { agent: "GPTBot", role: "OpenAI model training", kind: "training" },
  { agent: "ClaudeBot", role: "Anthropic model training", kind: "training" },
  { agent: "Google-Extended", role: "Gemini model training", kind: "training" },
];

export type BotAccess = GeoBot & { status: "allowed" | "partial" | "blocked" };

/**
 * Each bot's access from robots.txt: the homepage and the sample pages are
 * checked, so a rule that only blocks part of the site shows as partial.
 * Rules are matched on the path alone: robots-parser answers nothing for a
 * URL on another host, and a store's pages often live on www while its
 * robots.txt was fetched from the bare domain (or the other way round).
 */
export function checkBotAccess(
  robotsText: string | null,
  sampleUrls: string[],
): BotAccess[] {
  const base = "https://robots.check";
  const robots = robotsText
    ? robotsParser(`${base}/robots.txt`, robotsText)
    : null;
  const paths = [
    "/",
    ...sampleUrls.map((url) => {
      try {
        const parsed = new URL(url);
        return parsed.pathname + parsed.search;
      } catch {
        return "/";
      }
    }),
  ];
  return GEO_BOTS.map((bot) => {
    if (!robots) return { ...bot, status: "allowed" as const };
    const allowed = paths.filter(
      (path) => robots.isAllowed(`${base}${path}`, bot.agent) !== false,
    ).length;
    const status =
      allowed === paths.length
        ? ("allowed" as const)
        : allowed === 0
          ? ("blocked" as const)
          : ("partial" as const);
    return { ...bot, status };
  });
}

/**
 * Whether a 200 response really is the text file asked for (robots.txt,
 * llms.txt) and not an HTML page a shop serves for any unknown path.
 */
export function isPlainTextFile(body: string, contentType: string | null) {
  if (contentType && /html/i.test(contentType)) return false;
  const head = body
    .replace(/^\uFEFF/, "")
    .slice(0, 2048)
    .trimStart();
  return (
    !/^<(!doctype|html|head|body|!--)/i.test(head) &&
    !/<\/?(html|body|head)[\s>]/i.test(head)
  );
}

/** Whether a 200 response is an XML sitemap or sitemap index. */
export function isSitemapXml(body: string) {
  return /<(urlset|sitemapindex)[\s>]/i.test(body.slice(0, 4096));
}

export type JsonLdSummary = {
  /** Every type anywhere in the page's JSON-LD. */
  types: string[];
  /** Types of the page's own entities: top-level blocks and @graph members. */
  topTypes: string[];
  sameAs: string[];
  hasAggregateRating: boolean;
  hasGtin: boolean;
  hasBrand: boolean;
  hasOffers: boolean;
  hasFaq: boolean;
  organizationName: string | null;
  logo: string | null;
};

const MAX_DEPTH = 8;
const ORGANIZATION_TYPES = [
  "Organization",
  "OnlineStore",
  "Store",
  "Corporation",
  "LocalBusiness",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Every object node, at any depth (ProductGroup › hasVariant › offers …). */
function collectNodes(
  value: unknown,
  out: Record<string, unknown>[],
  depth = 0,
) {
  if (depth > MAX_DEPTH) return;
  if (Array.isArray(value)) {
    for (const item of value) collectNodes(item, out, depth + 1);
    return;
  }
  if (!isRecord(value)) return;
  out.push(value);
  for (const child of Object.values(value)) {
    if (child && typeof child === "object") collectNodes(child, out, depth + 1);
  }
}

/** The page's own entities: a block, a block's array items, @graph members. */
function topNodes(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(topNodes);
  if (!isRecord(value)) return [];
  const graph = value["@graph"];
  return graph ? [value, ...topNodes(graph)] : [value];
}

/** "Product", "schema:Product" and "https://schema.org/Product" alike. */
function typesOf(node: Record<string, unknown>): string[] {
  const raw = node["@type"];
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .filter((type): type is string => typeof type === "string")
    .map((type) => type.split(/[/:#]/).at(-1) ?? type);
}

function blockText(raw: string) {
  return raw
    .trim()
    .replace(/^<!--/, "")
    .replace(/-->$/, "")
    .replace(/^\/\/\s*<!\[CDATA\[/, "")
    .replace(/\/\/\s*\]\]>$/, "")
    .trim();
}

/** Reads every JSON-LD block in a page; invalid blocks are skipped. */
export function summarizeJsonLd(html: string): JsonLdSummary {
  const nodes: Record<string, unknown>[] = [];
  const top: Record<string, unknown>[] = [];
  const pattern =
    /<script\b[^>]*\btype\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    try {
      const parsed: unknown = JSON.parse(blockText(match[1]));
      collectNodes(parsed, nodes);
      top.push(...topNodes(parsed));
    } catch {
      // A broken block is what Google and AI crawlers skip too.
    }
  }
  const types = [...new Set(nodes.flatMap(typesOf))];
  const organization = nodes.find((node) =>
    typesOf(node).some((type) => ORGANIZATION_TYPES.includes(type)),
  );
  const sameAs = nodes.flatMap((node) => {
    const value = node.sameAs;
    if (typeof value === "string") return [value];
    if (Array.isArray(value))
      return value.filter((v): v is string => typeof v === "string");
    return [];
  });
  const has = (key: string) => nodes.some((node) => node[key] != null);
  const logo = organization?.logo;
  return {
    types,
    topTypes: [...new Set(top.flatMap(typesOf))],
    sameAs: [...new Set(sameAs)],
    hasAggregateRating: has("aggregateRating"),
    hasGtin: ["gtin", "gtin8", "gtin12", "gtin13", "gtin14"].some(has),
    hasBrand: has("brand"),
    hasOffers: has("offers"),
    hasFaq: types.includes("FAQPage"),
    organizationName:
      typeof organization?.name === "string" ? organization.name : null,
    logo:
      typeof logo === "string"
        ? logo
        : isRecord(logo) && typeof logo.url === "string"
          ? logo.url
          : null,
  };
}
