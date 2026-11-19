import type { BillingCustomerContext } from "@/server/billing/subscription";
import { normalizeKeyword } from "@/server/features/keywords/services/research/helpers";
import {
  createDataforseoClient,
  fetchKeywordMetricsForList,
} from "@/server/lib/dataforseo";
import { AppError } from "@/server/lib/errors";
import {
  buildQuestionExplorerQueries,
  isQuestionExplorerLanguage,
  QUESTION_EXPLORER_LANGUAGE_LABELS,
  QUESTION_EXPLORER_LANGUAGES,
  type QuestionGroupId,
} from "@/shared/question-explorer";

export type QuestionSuggestion = {
  keyword: string;
  searchVolume: number | null;
  cpc: number | null;
};

export type QuestionExplorerResult = {
  keyword: string;
  locationCode: number;
  languageCode: string;
  includeVolumes: boolean;
  groups: Array<{
    id: QuestionGroupId;
    modifiers: Array<{ modifier: string; suggestions: QuestionSuggestion[] }>;
  }>;
  totalSuggestions: number;
  failedRequests: number;
};

/**
 * Google suggests completions that drift away from the seed ("how" + "back
 * pain" can complete to "how back up iphone"); keep only those that still
 * contain every word of the keyword.
 */
function mentionsKeyword(suggestion: string, keywordWords: string[]) {
  return keywordWords.every((word) => suggestion.includes(word));
}

async function explore(
  input: {
    keyword: string;
    locationCode: number;
    languageCode: string;
    includeAlphabetical: boolean;
    includeVolumes: boolean;
  },
  billingCustomer: BillingCustomerContext,
): Promise<QuestionExplorerResult> {
  const keyword = normalizeKeyword(input.keyword);
  if (!keyword) throw new AppError("VALIDATION_ERROR", "Enter a keyword.");
  const { languageCode } = input;
  if (!isQuestionExplorerLanguage(languageCode)) {
    const supported = QUESTION_EXPLORER_LANGUAGES.map(
      (code) => QUESTION_EXPLORER_LANGUAGE_LABELS[code],
    ).join(", ");
    throw new AppError(
      "VALIDATION_ERROR",
      `Question Explorer supports ${supported}. Pick one of those languages.`,
    );
  }

  const queries = buildQuestionExplorerQueries({
    keyword,
    languageCode,
    includeAlphabetical: input.includeAlphabetical,
  });
  const client = createDataforseoClient(billingCustomer);
  const settled = await client.serp.autocompleteBatch(
    queries.map((query) => ({
      keyword: query.query,
      locationCode: input.locationCode,
      languageCode,
    })),
  );

  const rejected = settled.flatMap((result): unknown[] =>
    result.status === "rejected" ? [result.reason as unknown] : [],
  );
  // Out of credits or every request failed: there is nothing worth showing.
  const outOfCredits = rejected.find(
    (reason) =>
      reason instanceof AppError && reason.code === "INSUFFICIENT_CREDITS",
  );
  if (outOfCredits) throw outOfCredits;
  if (rejected.length === settled.length) throw rejected[0];

  const keywordWords = keyword.split(/\s+/);
  const seen = new Set<string>([keyword]);
  const byQuery = queries.map((query, index) => {
    const result = settled[index];
    const suggestions =
      result.status === "fulfilled"
        ? result.value.map(normalizeKeyword).filter((suggestion) => {
            if (seen.has(suggestion)) return false;
            if (!mentionsKeyword(suggestion, keywordWords)) return false;
            seen.add(suggestion);
            return true;
          })
        : [];
    return { ...query, suggestions };
  });

  const allSuggestions = byQuery.flatMap((query) => query.suggestions);
  const metrics = new Map<
    string,
    { searchVolume: number | null; cpc: number | null }
  >();
  if (input.includeVolumes && allSuggestions.length > 0) {
    const rows = await fetchKeywordMetricsForList(client, {
      keywords: allSuggestions,
      locationCode: input.locationCode,
      languageCode,
      creditFeature: "keyword_research",
    });
    for (const row of rows) {
      metrics.set(row.keyword.toLowerCase(), {
        searchVolume: row.searchVolume,
        cpc: row.cpc,
      });
    }
  }

  const groups: QuestionExplorerResult["groups"] = [];
  for (const query of byQuery) {
    if (query.suggestions.length === 0) continue;
    let group = groups.find((candidate) => candidate.id === query.group);
    if (!group) {
      group = { id: query.group, modifiers: [] };
      groups.push(group);
    }
    group.modifiers.push({
      modifier: query.modifier,
      suggestions: query.suggestions.map((suggestion) => ({
        keyword: suggestion,
        searchVolume: metrics.get(suggestion)?.searchVolume ?? null,
        cpc: metrics.get(suggestion)?.cpc ?? null,
      })),
    });
  }

  return {
    keyword,
    locationCode: input.locationCode,
    languageCode,
    includeVolumes: input.includeVolumes,
    groups,
    totalSuggestions: allSuggestions.length,
    failedRequests: rejected.length,
  };
}

export const QuestionExplorerService = { explore } as const;
