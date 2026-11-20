import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, Copy } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import { Skeleton } from "@/client/components/ui/skeleton";
import { CreateProjectModal } from "@/client/features/projects/CreateProjectModal";
import { Panel, Pill } from "@/client/features/seo-app/ui";
import { getStores } from "@/serverFunctions/weeklyReports";
import { MarketsEditor } from "@/client/features/markets/MarketsEditor";
import { marketLabel } from "@/shared/markets";

export function StoresSettings({ projectId }: { projectId: string }) {
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["stores"],
    queryFn: () => getStores(),
  });
  if (!query.data) return <Skeleton className="h-64 w-full rounded-xl" />;
  const { stores, serviceAccountEmail } = query.data;

  return (
    <div className="flex max-w-[1080px] flex-col gap-5">
      <Panel
        title="Stores"
        id="stores-h"
        aside={<Button onClick={() => setAdding(true)}>+ Add store</Button>}
      >
        <div className="flex flex-col">
          {stores.map((store) => (
            <div
              key={store.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-background py-3.5 first:border-t-0 first:pt-0"
            >
              <span
                aria-hidden
                className={
                  store.id === projectId
                    ? "flex size-9 items-center justify-center rounded-[9px] bg-primary text-sm font-semibold text-primary-foreground"
                    : "flex size-9 items-center justify-center rounded-[9px] bg-secondary text-sm font-semibold"
                }
              >
                {store.name.trim().charAt(0).toUpperCase()}
              </span>
              <div className="flex min-w-[200px] flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-medium">{store.name}</span>
                <span className="text-[13px] text-muted-foreground">
                  {store.domain ?? "No domain yet"} ·{" "}
                  {store.markets.map(marketLabel).join(" · ")}
                </span>
              </div>
              {store.gscProperty ? (
                <Pill tone="up">Search Console connected</Pill>
              ) : (
                <Pill tone="warn">Search Console not connected</Pill>
              )}
              <Button
                variant="outline"
                aria-expanded={editing === store.id}
                onClick={() =>
                  setEditing(editing === store.id ? null : store.id)
                }
              >
                {editing === store.id ? "Done" : "Markets"}
              </Button>
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <Link
                    to="/p/$projectId/settings"
                    params={{ projectId: store.id }}
                  />
                }
              >
                Edit
              </Button>
              {editing === store.id ? (
                <div className="w-full pt-1">
                  <MarketsEditor projectId={store.id} markets={store.markets} />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Connect Search Console" id="gsc-h">
        <div className="flex flex-col gap-3 text-sm">
          {serviceAccountEmail ? (
            <>
              <p className="m-0 leading-relaxed text-muted-foreground">
                Add this service account as a user (permission: Restricted) in
                Search Console › Settings › Users and permissions, then pick the
                property under Integrations.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-border bg-muted px-3 py-2.5 font-mono text-[13px] whitespace-nowrap">
                  {serviceAccountEmail}
                </code>
                <Button
                  variant="outline"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(serviceAccountEmail)
                      .then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1600);
                      })
                  }
                >
                  {copied ? <Check /> : <Copy />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </>
          ) : (
            <p className="m-0 leading-relaxed text-muted-foreground">
              Connect with your own Google account under Integrations, or set
              GOOGLE_SERVICE_ACCOUNT_JSON on the server so the app reads Search
              Console through a service account that never signs out.
            </p>
          )}
          <Link
            to="/p/$projectId/settings/integrations"
            params={{ projectId }}
            className="self-start font-medium text-link hover:text-link-hover"
          >
            Go to Integrations
          </Link>
        </div>
      </Panel>
      {adding ? <CreateProjectModal onClose={() => setAdding(false)} /> : null}
    </div>
  );
}
