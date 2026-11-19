import type { BotAccess } from "@/server/features/geo/geoChecks";
import {
  isProductPage,
  type AuditedPage,
} from "@/server/features/geo/geoScoring";

export type GeoFix = {
  key: "llms" | "robots" | "schema";
  label: string;
  title: string;
  why: string;
  where: string;
  file: string;
  code: string;
};

function section(pages: AuditedPage[], test: RegExp) {
  return pages.filter((page) => test.test(new URL(page.url).pathname));
}

function linkLine(page: AuditedPage) {
  const title = page.analysis.title.split(/\s[|–-]\s/)[0]?.trim() || page.url;
  const description = page.analysis.metaDescription.trim();
  return `- [${title}](${page.url})${description ? `: ${description}` : ""}`;
}

/** A starting llms.txt from the pages the audit read. */
function llmsFix(input: {
  brand: string;
  origin: string;
  pages: AuditedPage[];
  description: string | null;
}): GeoFix {
  const { pages } = input;
  const products = section(pages, /\/products?\//);
  const collections = section(pages, /\/collections?\//);
  const guides = section(pages, /\/(blogs?|news|guides?|articles?)\//);
  const rest = pages.filter(
    (page) =>
      ![...products, ...collections, ...guides].includes(page) &&
      new URL(page.url).pathname !== "/",
  );
  const lines = [
    `# ${input.brand}`,
    "",
    `> ${input.description ?? "[ONE-SENTENCE DESCRIPTION OF THE STORE]"}`,
  ];
  for (const [title, list] of [
    ["Products", products],
    ["Collections", collections],
    ["Guides", guides],
    ["More", rest],
  ] as const) {
    if (list.length === 0) continue;
    lines.push("", `## ${title}`, ...list.map(linkLine));
  }
  return {
    key: "llms",
    label: "llms.txt",
    title: "New file: llms.txt",
    why: "Gives AI assistants a short, reliable summary of the store and its most important pages.",
    where: "the root of the domain (with a Shopify app or an app proxy)",
    file: "/llms.txt",
    code: `${lines.join("\n")}\n`,
  };
}

/** robots.txt rules that open search bots and keep the training choices. */
function robotsFix(origin: string, bots: BotAccess[]): GeoFix {
  const blockedSearch = bots.filter(
    (bot) => bot.kind === "search" && bot.status !== "allowed",
  );
  const training = bots.filter((bot) => bot.kind === "training");
  const rules = [
    ...bots
      .filter((bot) => bot.kind === "search")
      .map((bot) => `User-agent: ${bot.agent}\nAllow: /`),
    ...training.map(
      (bot) =>
        `User-agent: ${bot.agent}\n${bot.status === "blocked" ? "Disallow: /" : "Allow: /"}`,
    ),
    `Sitemap: ${origin}/sitemap.xml`,
  ];
  return {
    key: "robots",
    label: "robots.txt",
    title:
      blockedSearch.length > 0
        ? `Allow ${blockedSearch.map((bot) => bot.agent).join(", ")}`
        : "Make AI bot access explicit",
    why:
      blockedSearch.length > 0
        ? "These search bots can't read every page, so AI answers can't cite them. Training bots keep their current setting: blocking them is a choice, not an error."
        : "Every AI search bot can read the site. Naming them keeps it that way when other rules change.",
    where: "Shopify theme › templates/robots.txt.liquid",
    file: "robots.txt (addition)",
    code: `${rules.join("\n\n")}\n`,
  };
}

/** JSON-LD for the first product page, else Organization for the store. */
function schemaFix(input: {
  brand: string;
  origin: string;
  pages: AuditedPage[];
}): GeoFix {
  const product = input.pages.find(isProductPage);
  // Split so the source never holds a literal closing script tag.
  const close = ["</", "script>"].join("");
  if (product) {
    const name =
      product.analysis.h1s[0] ??
      product.analysis.title.split(/\s[|–-]\s/)[0] ??
      "[PRODUCT NAME]";
    const json = {
      "@context": "https://schema.org",
      "@type": "Product",
      name,
      url: product.url,
      brand: { "@type": "Brand", name: input.brand },
      gtin13: "[GTIN]",
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "[RATING]",
        reviewCount: "[REVIEW COUNT]",
      },
      offers: {
        "@type": "Offer",
        priceCurrency: "EUR",
        price: "[PRICE]",
        availability: "https://schema.org/InStock",
      },
    };
    return {
      key: "schema",
      label: "JSON-LD Product",
      title: "Complete the Product schema",
      why: "Adds GTIN, brand and the review score so search engines and AI answers can take over the product facts.",
      where: "the product template, in the head",
      file: "snippets/product-schema.liquid",
      code: `<script type="application/ld+json">\n${JSON.stringify(json, null, 2)}\n${close}\n`,
    };
  }
  const json = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: input.brand,
    url: `${input.origin}/`,
    logo: "[LOGO URL]",
    sameAs: ["[INSTAGRAM URL]", "[FACEBOOK URL]", "[LINKEDIN URL]"],
  };
  return {
    key: "schema",
    label: "JSON-LD Organization",
    title: "Add Organization schema",
    why: "Tells AI assistants which brand this is and links it to its social profiles.",
    where: "the theme layout, in the head",
    file: "layout/theme.liquid",
    code: `<script type="application/ld+json">\n${JSON.stringify(json, null, 2)}\n${close}\n`,
  };
}

export function buildGeoFixes(input: {
  brand: string;
  origin: string;
  pages: AuditedPage[];
  bots: BotAccess[];
  description: string | null;
}): GeoFix[] {
  return [
    llmsFix(input),
    robotsFix(input.origin, input.bots),
    schemaFix(input),
  ];
}
