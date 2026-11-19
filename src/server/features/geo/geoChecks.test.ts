import { describe, expect, it } from "vitest";
import {
  checkBotAccess,
  isPlainTextFile,
  isSitemapXml,
  summarizeJsonLd,
} from "./geoChecks";

const statusOf = (robots: string | null, agent: string, urls: string[] = []) =>
  checkBotAccess(robots, urls).find((bot) => bot.agent === agent)?.status;

describe("checkBotAccess", () => {
  it("applies a bot's own group over the wildcard group", () => {
    const robots = [
      "User-agent: *",
      "Disallow: /",
      "",
      "User-agent: Googlebot",
      "Allow: /",
    ].join("\n");
    expect(statusOf(robots, "Googlebot")).toBe("allowed");
    expect(statusOf(robots, "Bingbot")).toBe("blocked");
  });

  it("marks a bot shut out of some sampled pages as partial", () => {
    const robots = "User-agent: PerplexityBot\nDisallow: /collections/";
    expect(
      statusOf(robots, "PerplexityBot", [
        "https://shop.example/collections/all",
      ]),
    ).toBe("partial");
  });

  it("matches rules on the path when pages live on another host", () => {
    const robots = "User-agent: GPTBot\nDisallow: /";
    // robots.txt came from the bare domain, the page from www.
    expect(
      statusOf(robots, "GPTBot", ["https://www.shop.example/products/a"]),
    ).toBe("blocked");
  });

  it("allows everything without a robots.txt", () => {
    expect(statusOf(null, "ClaudeBot")).toBe("allowed");
  });
});

describe("text file detection", () => {
  it("rejects an HTML page served with 200 for llms.txt", () => {
    expect(isPlainTextFile("\n  <!DOCTYPE html><html>…", "text/plain")).toBe(
      false,
    );
    expect(
      isPlainTextFile("# Shop\n> A store", "text/html; charset=utf-8"),
    ).toBe(false);
    expect(isPlainTextFile("<head><title>404</title></head>", null)).toBe(
      false,
    );
  });

  it("accepts a markdown llms.txt", () => {
    expect(
      isPlainTextFile("# Shop\n\n> A store\n- [A](https://x/a)", "text/plain"),
    ).toBe(true);
  });

  it("recognises sitemaps but not HTML", () => {
    expect(isSitemapXml('<?xml version="1.0"?><urlset xmlns="…">')).toBe(true);
    expect(isSitemapXml("<sitemapindex>")).toBe(true);
    expect(
      isSitemapXml("<!doctype html><html><body>Sitemap</body></html>"),
    ).toBe(false);
  });
});

describe("summarizeJsonLd", () => {
  it("reads @graph members, nested offers and URL-style types", () => {
    const json = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "https://schema.org/Organization",
          name: "Aero",
          sameAs: ["https://instagram.com/aero"],
          logo: { "@type": "ImageObject", url: "https://x/logo.png" },
        },
        {
          "@type": "ProductGroup",
          hasVariant: [
            {
              "@type": "Product",
              gtin13: "123",
              offers: { "@type": "Offer", price: "10" },
            },
          ],
        },
      ],
    };
    const summary = summarizeJsonLd(
      `<script type="application/ld+json">${JSON.stringify(json)}</script>`,
    );
    expect(summary.topTypes).toEqual(["Organization", "ProductGroup"]);
    expect(summary.types).toContain("Product");
    expect(summary).toMatchObject({
      hasOffers: true,
      hasGtin: true,
      organizationName: "Aero",
      logo: "https://x/logo.png",
      sameAs: ["https://instagram.com/aero"],
    });
  });

  it("reads a top-level array and skips broken blocks", () => {
    const html = [
      '<script type="application/ld+json">{broken</script>',
      `<script type=application/ld+json>${JSON.stringify([
        { "@type": "FAQPage" },
        { "@type": ["Product", "Thing"], aggregateRating: { ratingValue: 5 } },
      ])}</script>`,
    ].join("");
    const summary = summarizeJsonLd(html);
    expect(summary.hasFaq).toBe(true);
    expect(summary.hasAggregateRating).toBe(true);
    expect(summary.topTypes).toEqual(["FAQPage", "Product", "Thing"]);
  });
});
