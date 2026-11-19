import { reverse } from "remeda";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/client/components/ui/button";
import { Skeleton } from "@/client/components/ui/skeleton";
import { ErrorState } from "@/client/components/ErrorState";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { useProject } from "@/client/features/seo-app/hooks";
import {
  PageFrame,
  PageTitle,
  Panel,
  pathOf,
  Pill,
  ScoreBar,
  SegmentedTabs,
  Sparkline,
} from "@/client/features/seo-app/ui";
import { getGeoAudit, runGeoAudit } from "@/serverFunctions/geo";
import type { GeoAuditView } from "@/server/features/geo/GeoAuditService";

const formatDateTime = (iso: string) =>
  new Date(
    iso.includes("T") ? iso : `${iso.replace(" ", "T")}Z`,
  ).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export function geoAuditQuery(projectId: string, auditId?: string) {
  return {
    queryKey: ["geo-audit", projectId, auditId ?? "latest"],
    queryFn: () => getGeoAudit({ data: { projectId, auditId } }),
    staleTime: 5 * 60_000,
  };
}

export function GeoPage({ projectId }: { projectId: string }) {
  const project = useProject(projectId);
  const queryClient = useQueryClient();
  const [auditId, setAuditId] = useState<string | undefined>();
  const query = useQuery(geoAuditQuery(projectId, auditId));
  const run = useMutation({
    mutationFn: () => runGeoAudit({ data: { projectId } }),
    onSuccess: async () => {
      setAuditId(undefined);
      await queryClient.invalidateQueries({
        queryKey: ["geo-audit", projectId],
      });
      toast.success("GEO audit finished");
    },
    onError: (error) =>
      toast.error(getStandardErrorMessage(error, "The GEO audit failed.")),
  });
  const audit = query.data?.audit ?? null;
  const history = query.data?.history ?? [];

  return (
    <PageFrame wide>
      <PageTitle
        title="AI visibility"
        domain={project?.domain}
        subtitle={
          audit
            ? `Audit of ${formatDateTime(audit.createdAt)} · ${audit.pages.length} pages checked`
            : "How easily AI search engines can find, read and cite your store"
        }
        actions={
          <>
            {history.length > 1 ? (
              <label className="flex items-center">
                <span className="sr-only">Previous audits</span>
                <select
                  value={auditId ?? ""}
                  onChange={(event) =>
                    setAuditId(event.target.value || undefined)
                  }
                  className="min-h-10 rounded-lg border border-input bg-card px-3 text-sm"
                >
                  <option value="">Latest audit</option>
                  {reverse([...history]).map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {formatDateTime(entry.createdAt)} · {entry.score}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <Button
              onClick={() => run.mutate()}
              pending={run.isPending}
              disabled={run.isPending || !project?.domain}
            >
              <Sparkles />
              {run.isPending ? "Auditing…" : "Run audit now"}
            </Button>
          </>
        }
      />

      {query.isPending ? (
        <Skeleton className="h-[520px] w-full rounded-xl" />
      ) : query.isError ? (
        <ErrorState
          message={getStandardErrorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : !audit ? (
        <Panel title="No GEO audit yet">
          <p className="m-0 max-w-prose text-sm leading-relaxed text-muted-foreground">
            {project?.domain
              ? "Run the first audit to see which AI crawlers can read the store, how well your pages can be quoted in AI answers, and what to fix first. It reads up to ten pages and takes about half a minute."
              : "Add the store's domain in its settings first."}
          </p>
        </Panel>
      ) : (
        <GeoAuditBody audit={audit} history={history} />
      )}
    </PageFrame>
  );
}

function GeoAuditBody({
  audit,
  history,
}: {
  audit: GeoAuditView;
  history: Array<{ id: string; score: number; createdAt: string }>;
}) {
  const index = history.findIndex((entry) => entry.id === audit.id);
  const previous = index > 0 ? history[index - 1] : null;
  const delta = previous ? audit.score - previous.score : null;
  return (
    <>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="flex flex-col gap-5">
          <Panel title="Total score" id="geo-score">
            <div className="flex flex-col gap-3">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-semibold tracking-tight tabular-nums">
                  {audit.score}
                </span>
                <span className="text-muted-foreground">/ 100</span>
                {delta !== null && delta !== 0 ? (
                  <Pill tone={delta > 0 ? "up" : "down"}>
                    {delta > 0 ? "↑" : "↓"} {Math.abs(delta)}
                  </Pill>
                ) : null}
              </div>
              <span className="text-sm font-medium">
                {audit.band} ·{" "}
                {audit.band === "Strong"
                  ? "80–100"
                  : audit.band === "Fair"
                    ? "60–79"
                    : audit.band === "Moderate"
                      ? "40–59"
                      : "0–39"}
              </span>
              <span className="text-xs leading-relaxed text-muted-foreground">
                0–39 Weak · 40–59 Moderate · 60–79 Fair · 80–100 Strong
                {previous ? (
                  <>
                    <br />
                    Previous audit {previous.score}
                  </>
                ) : null}
              </span>
              <Sparkline
                values={history
                  .slice(0, index + 1)
                  .slice(-8)
                  .map((entry) => entry.score)}
                label={`Score over the last audits: ${history
                  .slice(0, index + 1)
                  .slice(-8)
                  .map((entry) => entry.score)
                  .join(", ")}`}
              />
            </div>
          </Panel>
          <Panel
            title={`Built from ${audit.categories.length} categories`}
            id="geo-categories"
            aside={
              <span className="text-xs text-muted-foreground">
                score · weight
              </span>
            }
          >
            <div className="flex flex-col">
              {audit.categories.map((category) => (
                <div
                  key={category.key}
                  className="flex flex-col gap-1.5 border-t border-background py-2.5 first:border-t-0 first:pt-0"
                >
                  <div className="flex items-baseline gap-2 text-sm">
                    <span className="flex-1 font-medium">{category.label}</span>
                    <span className="font-semibold tabular-nums">
                      {category.score ?? "–"}
                    </span>
                    <span className="w-9 text-right text-xs text-muted-foreground">
                      {category.weight}%
                    </span>
                  </div>
                  {category.score !== null ? (
                    <ScoreBar score={category.score} />
                  ) : null}
                  <span className="text-xs text-muted-foreground">
                    {category.note}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
        <div className="flex flex-col gap-5">
          <Panel title="AI crawler access" id="geo-bots">
            <div className="flex flex-col">
              {audit.bots.map((bot) => (
                <div
                  key={bot.agent}
                  className="flex items-center gap-3 border-t border-background py-2.5 first:border-t-0 first:pt-0"
                >
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{
                      background:
                        bot.status === "allowed"
                          ? "var(--success)"
                          : bot.status === "partial"
                            ? "var(--warning)"
                            : "var(--muted-foreground)",
                    }}
                  />
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm font-medium">{bot.agent}</span>
                    <span className="text-xs text-muted-foreground">
                      {bot.role}
                    </span>
                  </div>
                  <Pill
                    tone={
                      bot.status === "allowed"
                        ? "up"
                        : bot.status === "partial"
                          ? "warn"
                          : "neutral"
                    }
                  >
                    {bot.status === "allowed"
                      ? "Allowed"
                      : bot.status === "partial"
                        ? "Partly"
                        : "Blocked"}
                  </Pill>
                </div>
              ))}
            </div>
            <p className="mt-3 mb-0 text-xs leading-relaxed text-muted-foreground">
              Checked against robots.txt for the homepage and every audited
              page. Blocking a training bot such as GPTBot is a choice, not an
              error.
            </p>
          </Panel>
          <Panel
            title="Citability per page"
            id="geo-pages"
            aside={
              <span className="text-xs text-muted-foreground">
                how easily an AI answer can quote the page
              </span>
            }
            bodyClassName="px-0 pb-0"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[13px] text-muted-foreground">
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Page
                    </th>
                    <th
                      scope="col"
                      className="w-[150px] px-3 py-2.5 font-medium"
                    >
                      Score
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Biggest gap
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {audit.pages.map((page) => (
                    <tr key={page.url} className="border-t border-background">
                      <td
                        className="max-w-[260px] truncate px-5 py-2.5 font-medium"
                        title={page.url}
                      >
                        {pathOf(page.url)}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 font-semibold tabular-nums">
                            {page.score}
                          </span>
                          <ScoreBar score={page.score} />
                        </div>
                      </td>
                      <td className="px-5 py-2.5 text-muted-foreground">
                        {page.gap}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </div>
      <FixesPanel fixes={audit.fixes} />
    </>
  );
}

function FixesPanel({ fixes }: { fixes: GeoAuditView["fixes"] }) {
  const [selected, setSelected] = useState(fixes[0]?.key ?? "llms");
  const [copied, setCopied] = useState(false);
  const fix = fixes.find((item) => item.key === selected) ?? fixes[0];
  if (!fix) return null;
  return (
    <Panel
      title="Suggested fixes"
      id="geo-fixes"
      aside={
        <span className="text-xs text-muted-foreground">
          Examples only: nothing is changed on the store automatically.
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        <SegmentedTabs
          label="Fix"
          value={fix.key}
          onChange={(value) => {
            setSelected(value);
            setCopied(false);
          }}
          tabs={fixes.map((item) => ({ value: item.key, label: item.label }))}
        />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold">{fix.title}</span>
          <span className="text-sm text-muted-foreground">{fix.why}</span>
          <span className="text-xs text-muted-foreground">
            Place in: {fix.where}
          </span>
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="flex items-center justify-between gap-3 border-b border-border bg-muted px-4 py-2">
            <span className="font-mono text-xs text-muted-foreground">
              {fix.file}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(fix.code).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                });
              }}
            >
              {copied ? <Check /> : <Copy />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <pre className="m-0 max-h-[360px] overflow-auto bg-card p-4 font-mono text-[13px] leading-relaxed">
            {fix.code}
          </pre>
        </div>
      </div>
    </Panel>
  );
}
