import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/client/components/ui/button";
import { Skeleton } from "@/client/components/ui/skeleton";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  ConnectSearchConsole,
  searchConsoleOverviewQuery,
  useProject,
} from "@/client/features/seo-app/hooks";
import { PageFrame, PageTitle, Panel } from "@/client/features/seo-app/ui";
import { geoAuditQuery } from "@/client/features/geo/GeoPage";
import { runGeoAudit } from "@/serverFunctions/geo";
import { gscCountryName } from "@/shared/search-console";
import { TrendChart } from "@/client/features/seo-app/TrendChart";
import {
  OrganicPanel,
  SiteScorePanel,
  TodoPanel,
} from "@/client/features/seo-app/DashboardMainPanels";
import {
  CountriesPanel,
  NotesPanel,
} from "@/client/features/seo-app/DashboardSidePanels";

const HELP_DISMISSED_KEY = "seo-app:dashboard-help-dismissed";

function readDismissed() {
  try {
    return window.localStorage.getItem(HELP_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function SeoDashboardPage({ projectId }: { projectId: string }) {
  const project = useProject(projectId);
  const queryClient = useQueryClient();
  const [country, setCountry] = useState<string | undefined>();
  const [showHelp, setShowHelp] = useState(() => !readDismissed());
  const overview = useQuery(
    searchConsoleOverviewQuery({ projectId, days: 28, country }),
  );
  const allCountries = useQuery(
    searchConsoleOverviewQuery({ projectId, days: 28 }),
  );
  const geo = useQuery(geoAuditQuery(projectId));
  const audit = useMutation({
    mutationFn: () => runGeoAudit({ data: { projectId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["geo-audit", projectId],
      });
      toast.success("GEO audit finished");
    },
    onError: (error) =>
      toast.error(getStandardErrorMessage(error, "The GEO audit failed.")),
  });
  const gsc = overview.data?.connected ? overview.data : null;
  const countries = allCountries.data?.connected
    ? allCountries.data.countries
    : [];

  return (
    <PageFrame wide>
      <PageTitle
        title="Overview"
        domain={project?.domain ?? project?.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2 text-sm">
            <span>in</span>
            <label>
              <span className="sr-only">Country</span>
              <select
                data-slot="native-select"
                value={country ?? ""}
                onChange={(event) =>
                  setCountry(event.target.value || undefined)
                }
                className="min-h-9 rounded-lg border border-input bg-card px-2.5 text-sm font-medium text-foreground"
              >
                <option value="">All countries</option>
                {countries.slice(0, 12).map((row) => (
                  <option key={row.key} value={row.key}>
                    {gscCountryName(row.key)}
                  </option>
                ))}
              </select>
            </label>
            <span>· last 28 days</span>
          </span>
        }
        actions={
          <Button
            onClick={() => audit.mutate()}
            pending={audit.isPending}
            disabled={audit.isPending || !project?.domain}
          >
            <Sparkles />
            {audit.isPending ? "Auditing…" : "Run audit now"}
          </Button>
        }
      />

      {showHelp ? (
        <section
          aria-labelledby="help-h"
          className="relative flex flex-wrap items-center gap-4 rounded-xl border border-border bg-secondary px-5 py-4"
        >
          <div className="flex min-w-[220px] flex-1 flex-col gap-1">
            <h2 id="help-h" className="m-0 text-[15px] font-semibold">
              Not sure where to start?
            </h2>
            <span className="text-[13px] text-muted-foreground">
              Two short steps to set the app up for a store.
            </span>
          </div>
          <Link
            to="/p/$projectId/settings/stores"
            params={{ projectId }}
            className="flex min-w-[180px] flex-col gap-0.5 rounded-lg border border-border bg-card px-4 py-2.5 no-underline hover:border-input"
          >
            <span className="text-xs text-muted-foreground">Step 1</span>
            <span className="text-sm font-medium text-foreground">
              Connect Search Console
            </span>
          </Link>
          <Link
            to="/p/$projectId/geo"
            params={{ projectId }}
            className="mr-8 flex min-w-[180px] flex-col gap-0.5 rounded-lg border border-border bg-card px-4 py-2.5 no-underline hover:border-input"
          >
            <span className="text-xs text-muted-foreground">Step 2</span>
            <span className="text-sm font-medium text-foreground">
              Run your first GEO audit
            </span>
          </Link>
          <button
            type="button"
            aria-label="Hide"
            onClick={() => {
              setShowHelp(false);
              try {
                window.localStorage.setItem(HELP_DISMISSED_KEY, "1");
              } catch {
                // Hidden for this visit only.
              }
            }}
            className="absolute top-2 right-2 flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-card"
          >
            <X className="size-4" />
          </button>
        </section>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-5">
          {overview.isPending ? (
            <Skeleton className="h-[460px] w-full rounded-xl" />
          ) : !gsc ? (
            <ConnectSearchConsole projectId={projectId} />
          ) : (
            <>
              <OrganicPanel
                gsc={gsc}
                countryLabel={
                  country ? gscCountryName(country) : "all countries"
                }
              />
              <Panel title="Trend" id="trend-h">
                <div className="mb-3 flex flex-wrap gap-4 text-[13px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-0.5 w-4 rounded bg-chart-1"
                      aria-hidden
                    />
                    Clicks · last 28 days
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-0.5 w-4 rounded bg-chart-2"
                      aria-hidden
                    />
                    Previous period
                  </span>
                </div>
                <TrendChart
                  label="Clicks per day, this period against the previous one"
                  current={gsc.daily.map((day) => ({
                    date: day.date,
                    value: day.clicks,
                  }))}
                  previous={gsc.previousDaily.map((day) => ({
                    date: day.date,
                    value: day.clicks,
                  }))}
                />
              </Panel>
            </>
          )}
          <TodoPanel projectId={projectId} />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <SiteScorePanel
            projectId={projectId}
            loading={geo.isPending}
            data={geo.data}
          />
          {countries.length > 0 ? (
            <CountriesPanel countries={countries} />
          ) : null}
          <NotesPanel projectId={projectId} />
        </div>
      </div>
    </PageFrame>
  );
}
