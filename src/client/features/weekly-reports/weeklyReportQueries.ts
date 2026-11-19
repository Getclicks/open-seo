import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  getWeeklyReports,
  setWeeklyReportActionStatus,
} from "@/serverFunctions/weeklyReports";

export type Report = Awaited<ReturnType<typeof getWeeklyReports>>[number];
type Status = Report["actions"][number]["status"];

export const STATUSES: Status[] = ["open", "in_progress", "done"];

export const STATUS_LABEL: Record<Status, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
};

export const weeklyReportsQuery = (projectId: string) => ({
  queryKey: ["weekly-reports", projectId],
  queryFn: () => getWeeklyReports({ data: { projectId } }),
});

export function formatReportDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function shortUtcDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function weekLabel(report: Report) {
  const start = new Date(`${report.periodStart}T00:00:00Z`);
  const firstThursday = new Date(start);
  firstThursday.setUTCDate(
    start.getUTCDate() + 3 - ((start.getUTCDay() + 6) % 7),
  );
  const yearStart = new Date(Date.UTC(firstThursday.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((firstThursday.getTime() - yearStart.getTime()) / 86_400_000 -
        3 +
        ((yearStart.getUTCDay() + 6) % 7)) /
        7,
    );
  return `Week ${week} · ${shortUtcDate(report.periodStart)} – ${shortUtcDate(report.periodEnd)}`;
}

export function useActionStatus(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { actionId: string; status: Status }) =>
      setWeeklyReportActionStatus({ data: { projectId, ...input } }),
    onMutate: async (input) => {
      const key = weeklyReportsQuery(projectId).queryKey;
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData<Report[]>(key, (reports) =>
        reports?.map((report) => ({
          ...report,
          actions: report.actions.map((action) =>
            action.id === input.actionId
              ? { ...action, status: input.status }
              : action,
          ),
        })),
      );
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: weeklyReportsQuery(projectId).queryKey,
      }),
  });
}
