import { expect, it } from "vitest";
import { gscCountryForLocation, marketLabel, parseMarketKey } from "./markets";

it("maps DataForSEO locations to Search Console's alpha-3 countries", () => {
  expect(gscCountryForLocation(2528)).toBe("nld");
  expect(gscCountryForLocation(2056)).toBe("bel");
  expect(gscCountryForLocation(2250)).toBe("fra");
  expect(gscCountryForLocation(2276)).toBe("deu");
  expect(gscCountryForLocation(2826)).toBe("gbr");
  expect(gscCountryForLocation(2840)).toBe("usa");
});

it("names the language only where the country needs it", () => {
  expect(marketLabel({ locationCode: 2528, languageCode: "nl" })).toBe("NL");
  expect(marketLabel({ locationCode: 2056, languageCode: "fr" })).toBe(
    "BE (fr)",
  );
});

it("rejects malformed market keys", () => {
  expect(parseMarketKey("2056-fr")).toEqual({
    locationCode: 2056,
    languageCode: "fr",
  });
  expect(parseMarketKey("all")).toBeNull();
});
