import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Download, Search } from "lucide-react";
import { CopyButton } from "@/client/components/CopyButton";
import { ErrorState } from "@/client/components/ErrorState";
import { PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Field, FieldLabel } from "@/client/components/ui/field";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Skeleton } from "@/client/components/ui/skeleton";
import { InsufficientCreditsError } from "@/client/features/billing/InsufficientCreditsError";
import { ProjectMarketFields } from "@/client/features/projects/ProjectMarketFields";
import { useProjectMarket } from "@/client/features/projects/useProjectMarket";
import type { ProjectMarket } from "@/client/features/projects/types";
import {
  getErrorCode,
  getStandardErrorMessage,
} from "@/client/lib/error-messages";
import type { QuestionExplorerResult } from "@/server/features/keywords/services/QuestionExplorerService";
import {
  isQuestionExplorerLanguage,
  QUESTION_EXPLORER_LANGUAGE_LABELS,
  QUESTION_EXPLORER_LANGUAGES,
  QUESTION_EXPLORER_REQUEST_USD,
  QUESTION_GROUP_LABELS,
  questionExplorerRequestCount,
} from "@/shared/question-explorer";
import { exploreQuestions } from "@/serverFunctions/keywords";
import type { z } from "zod";
import type { questionExplorerSearchSchema } from "@/types/schemas/keywords";

type Search = z.infer<typeof questionExplorerSearchSchema>;

const SUPPORTED_LANGUAGES = QUESTION_EXPLORER_LANGUAGES.map(
  (code) => QUESTION_EXPLORER_LANGUAGE_LABELS[code],
).join(", ");

export function QuestionExplorerPage({
  projectId,
  search,
}: {
  projectId: string;
  search: Search;
}) {
  const navigate = useNavigate({ from: "/p/$projectId/questions" });
  const projectMarket = useProjectMarket(projectId);
  const [keyword, setKeyword] = useState(search.q ?? "");
  const [marketDraft, setMarketDraft] = useState<ProjectMarket | null>(null);
  const [includeAlphabetical, setIncludeAlphabetical] = useState(
    search.az ?? false,
  );
  const [includeVolumes, setIncludeVolumes] = useState(search.vol ?? false);

  const market: ProjectMarket | null =
    marketDraft ??
    (search.loc && search.lang
      ? { locationCode: search.loc, languageCode: search.lang }
      : (projectMarket ?? null));
  const languageSupported = market
    ? isQuestionExplorerLanguage(market.languageCode)
    : true;
  const requestCount =
    market && isQuestionExplorerLanguage(market.languageCode)
      ? questionExplorerRequestCount({
          languageCode: market.languageCode,
          includeAlphabetical,
        })
      : 0;

  const query = useQuery({
    queryKey: [
      "question-explorer",
      projectId,
      search.q,
      search.loc,
      search.lang,
      Boolean(search.az),
      Boolean(search.vol),
    ],
    queryFn: () =>
      exploreQuestions({
        data: {
          projectId,
          keyword: search.q ?? "",
          locationCode: search.loc,
          languageCode: search.lang,
          includeAlphabetical: search.az ?? false,
          includeVolumes: search.vol ?? false,
        },
      }),
    enabled: Boolean(search.q),
    // Every run is a paid set of Google requests: never refetch on its own.
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = keyword.trim();
    if (!trimmed || !market || !languageSupported) return;
    void navigate({
      search: {
        q: trimmed,
        loc: market.locationCode,
        lang: market.languageCode,
        az: includeAlphabetical || undefined,
        vol: includeVolumes || undefined,
      },
    });
  };

  return (
    <div className="overflow-auto px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <PageHeader
          title="Question Explorer"
          description="The questions, prepositions and comparisons people type into Google around a topic, straight from Google's search suggestions."
        />

        <Card>
          <CardContent>
            <form onSubmit={onSubmit} noValidate className="space-y-5">
              <Field>
                <FieldLabel htmlFor="question-explorer-keyword">
                  Keyword
                </FieldLabel>
                <Input
                  id="question-explorer-keyword"
                  value={keyword}
                  maxLength={80}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="e.g. rugpijn"
                  autoComplete="off"
                  autoFocus
                />
              </Field>

              {market ? (
                <ProjectMarketFields value={market} onChange={setMarketDraft} />
              ) : (
                <Skeleton className="h-16 w-full" />
              )}
              {!languageSupported ? (
                <p className="text-sm text-destructive">
                  Question Explorer supports {SUPPORTED_LANGUAGES}. Pick one of
                  those languages.
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <Label className="font-normal">
                  <Checkbox
                    checked={includeAlphabetical}
                    onCheckedChange={(checked) =>
                      setIncludeAlphabetical(checked)
                    }
                  />
                  Include A–Z suggestions (26 extra requests)
                </Label>
                <Label className="font-normal">
                  <Checkbox
                    checked={includeVolumes}
                    onCheckedChange={(checked) => setIncludeVolumes(checked)}
                  />
                  Add search volume and CPC
                </Label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {requestCount} Google requests, about $
                  {(requestCount * QUESTION_EXPLORER_REQUEST_USD).toFixed(2)} at
                  DataForSEO
                  {includeVolumes ? ", plus one search volume lookup" : ""}.
                </p>
                <Button
                  type="submit"
                  disabled={
                    !keyword.trim() ||
                    !market ||
                    !languageSupported ||
                    query.isFetching
                  }
                >
                  <Search />
                  {query.isFetching ? "Exploring…" : "Explore"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {query.isFetching ? <ResultsSkeleton /> : null}
        {query.isError ? (
          getErrorCode(query.error) === "INSUFFICIENT_CREDITS" ? (
            <InsufficientCreditsError />
          ) : (
            <ErrorState
              message={getStandardErrorMessage(
                query.error,
                "Couldn't load Google suggestions. Try again.",
              )}
              onRetry={() => void query.refetch()}
              isRetrying={query.isFetching}
            />
          )
        ) : null}
        {query.data && !query.isFetching ? (
          <QuestionExplorerResults projectId={projectId} result={query.data} />
        ) : null}
      </div>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} className="h-64 w-full" />
      ))}
    </div>
  );
}

function allKeywords(result: QuestionExplorerResult) {
  return result.groups.flatMap((group) =>
    group.modifiers.flatMap((modifier) =>
      modifier.suggestions.map((suggestion) => ({
        group: QUESTION_GROUP_LABELS[group.id],
        modifier: modifier.modifier,
        ...suggestion,
      })),
    ),
  );
}

function csvCell(value: string | number | null) {
  if (value == null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadCsv(result: QuestionExplorerResult) {
  const header = ["group", "modifier", "keyword", "search_volume", "cpc"];
  const lines = allKeywords(result).map((row) =>
    [row.group, row.modifier, row.keyword, row.searchVolume, row.cpc]
      .map(csvCell)
      .join(","),
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `questions-${result.keyword.replaceAll(/\s+/g, "-")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function QuestionExplorerResults({
  projectId,
  result,
}: {
  projectId: string;
  result: QuestionExplorerResult;
}) {
  if (result.totalSuggestions === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Google has no suggestions for “{result.keyword}” in this market. Try a
          shorter or more common keyword.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {result.totalSuggestions} suggestions for{" "}
          <span className="font-medium text-foreground">{result.keyword}</span>
          {result.failedRequests > 0
            ? ` (${result.failedRequests} Google requests failed and are left out)`
            : ""}
        </p>
        <div className="flex gap-2">
          <CopyButton
            value={allKeywords(result)
              .map((row) => row.keyword)
              .join("\n")}
            label="Copy all"
            successMessage="Suggestions copied"
            size="sm"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCsv(result)}
          >
            <Download />
            CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {result.groups.map((group) => (
          <Card key={group.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {QUESTION_GROUP_LABELS[group.id]}
                <Badge variant="secondary">
                  {group.modifiers.reduce(
                    (sum, modifier) => sum + modifier.suggestions.length,
                    0,
                  )}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {group.modifiers.map((modifier) => (
                <section key={modifier.modifier} className="space-y-1">
                  <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {modifier.modifier}
                  </h3>
                  <ul className="divide-y divide-border">
                    {modifier.suggestions.map((suggestion) => (
                      <li
                        key={suggestion.keyword}
                        className="flex items-center justify-between gap-3 py-1.5 text-sm"
                      >
                        <Link
                          to="/p/$projectId/keywords"
                          params={{ projectId }}
                          search={{
                            q: suggestion.keyword,
                            loc: result.locationCode,
                          }}
                          className="min-w-0 truncate hover:underline"
                          title="Open in Keyword Research"
                        >
                          {suggestion.keyword}
                        </Link>
                        {result.includeVolumes ? (
                          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                            {suggestion.searchVolume != null
                              ? suggestion.searchVolume.toLocaleString()
                              : "–"}
                            {suggestion.cpc != null
                              ? ` · $${suggestion.cpc.toFixed(2)}`
                              : ""}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
