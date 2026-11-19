import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Skeleton } from "@/client/components/ui/skeleton";
import { Switch } from "@/client/components/ui/switch";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { Panel } from "@/client/features/seo-app/ui";
import {
  getWeeklyReportSettings,
  updateWeeklyReportSettings,
} from "@/serverFunctions/weeklyReports";
import { WEEKDAY_NAMES } from "@/shared/weekly-schedule";

type Settings = Awaited<ReturnType<typeof getWeeklyReportSettings>>;

const fieldClass =
  "min-h-11 rounded-lg border border-input bg-card px-3 text-[15px] text-foreground";

export function WeeklyReportSettings({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const key = ["weekly-report-settings", projectId];
  const query = useQuery({
    queryKey: key,
    queryFn: () => getWeeklyReportSettings({ data: { projectId } }),
  });
  const [draft, setDraft] = useState<Settings | null>(null);
  const [recipients, setRecipients] = useState("");
  useEffect(() => {
    if (query.data && !draft) {
      setDraft(query.data);
      setRecipients(query.data.recipients.join(", "));
    }
  }, [query.data, draft]);
  const save = useMutation({
    mutationFn: (settings: Settings) =>
      updateWeeklyReportSettings({
        data: {
          projectId,
          enabled: settings.enabled,
          weekday: settings.weekday,
          time: settings.time,
          timezone: settings.timezone,
          includeGsc: settings.includeGsc,
          includeGeo: settings.includeGeo,
          emailEnabled: settings.emailEnabled,
          recipients: recipients
            .split(/[\s,;]+/)
            .map((email) => email.trim())
            .filter(Boolean),
        },
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(key, saved);
      setDraft(saved);
      setRecipients(saved.recipients.join(", "));
      toast.success("Schedule saved");
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  if (!draft) return <Skeleton className="h-80 w-full rounded-xl" />;
  const set = (patch: Partial<Settings>) => setDraft({ ...draft, ...patch });
  const nextRun = query.data?.nextRunAt
    ? new Date(query.data.nextRunAt).toLocaleString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: draft.timezone,
      })
    : null;

  return (
    <form
      className="flex max-w-[1080px] flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate(draft);
      }}
    >
      <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2">
        <Panel
          title="Weekly report schedule"
          id="schedule-h"
          aside={
            <Switch
              checked={draft.enabled}
              onCheckedChange={(enabled) => set({ enabled })}
              aria-label="Weekly report on"
            />
          }
          footer={
            <span>
              Next run:{" "}
              <strong className="font-semibold text-foreground">
                {draft.enabled && nextRun ? nextRun : "none"}
              </strong>{" "}
              ({draft.timezone})
            </span>
          }
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-3">
              <label className="flex min-w-[140px] flex-1 flex-col gap-1.5 text-[13px] text-muted-foreground">
                Day
                <select
                  data-slot="native-select"
                  value={draft.weekday}
                  onChange={(event) =>
                    set({ weekday: Number(event.target.value) })
                  }
                  className={fieldClass}
                >
                  {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                    <option key={day} value={day}>
                      {WEEKDAY_NAMES[day]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-[110px] flex-1 flex-col gap-1.5 text-[13px] text-muted-foreground">
                Time
                <input
                  data-slot="native-input"
                  type="time"
                  value={draft.time}
                  onChange={(event) => set({ time: event.target.value })}
                  className={fieldClass}
                />
              </label>
            </div>
            <div className="flex flex-col text-sm">
              <label className="flex min-h-11 items-center gap-2.5">
                <Checkbox
                  checked={draft.includeGsc}
                  onCheckedChange={(includeGsc) => set({ includeGsc })}
                />
                Search Console check
              </label>
              <label className="flex min-h-11 items-center gap-2.5">
                <Checkbox
                  checked={draft.includeGeo}
                  onCheckedChange={(includeGeo) => set({ includeGeo })}
                />
                Then run a GEO audit
              </label>
            </div>
          </div>
        </Panel>
        <Panel title="Delivery" id="delivery-h">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3 py-2">
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="text-sm font-medium">In the app</span>
                <span className="text-xs text-muted-foreground">
                  Every report stays readable under Weekly reports
                </span>
              </div>
              <Switch checked disabled aria-label="In the app" />
            </div>
            <div className="flex items-center gap-3 border-t border-background py-2">
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="text-sm font-medium">Email</span>
                <span className="text-xs text-muted-foreground">
                  {draft.emailAvailable
                    ? "The summary and actions, with a link to the report"
                    : "Set RESEND_API_KEY and WEEKLY_REPORT_FROM on the server to send email"}
                </span>
              </div>
              <Switch
                checked={draft.emailEnabled}
                disabled={!draft.emailAvailable}
                onCheckedChange={(emailEnabled) => set({ emailEnabled })}
                aria-label="Email"
              />
            </div>
            <label className="mt-2 flex flex-col gap-1.5 text-[13px] text-muted-foreground">
              Recipients
              <input
                data-slot="native-input"
                type="text"
                value={recipients}
                onChange={(event) => setRecipients(event.target.value)}
                placeholder="you@example.com, colleague@example.com"
                disabled={!draft.emailAvailable}
                className={fieldClass}
              />
            </label>
          </div>
        </Panel>
      </div>
      <div className="flex justify-end">
        <Button
          type="submit"
          pending={save.isPending}
          disabled={save.isPending}
        >
          Save schedule
        </Button>
      </div>
    </form>
  );
}
