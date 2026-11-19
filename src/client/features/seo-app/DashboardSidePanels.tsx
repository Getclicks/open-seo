import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/client/components/ui/button";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { ChangePill, formatNumber, Panel } from "@/client/features/seo-app/ui";
import {
  addProjectNote,
  deleteProjectNote,
  getProjectNotes,
} from "@/serverFunctions/weeklyReports";
import { gscCountryName } from "@/shared/search-console";

const COUNTRY_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-4)",
  "var(--chart-3)",
  "var(--input)",
];

export function CountriesPanel({
  countries,
}: {
  countries: Array<{
    key: string;
    clicks: number;
    clicksChange: number | null;
  }>;
}) {
  const total = countries.reduce((sum, row) => sum + row.clicks, 0);
  const top = countries.slice(0, 4);
  const rest = countries.slice(4);
  const rows = [
    ...top.map((row) => ({ ...row, name: gscCountryName(row.key) })),
    ...(rest.length > 0
      ? [
          {
            key: "other",
            name: "Other",
            clicks: rest.reduce((sum, row) => sum + row.clicks, 0),
            clicksChange: null,
          },
        ]
      : []),
  ];
  const label = rows
    .map(
      (row) =>
        `${row.name} ${total ? Math.round((row.clicks / total) * 100) : 0}%`,
    )
    .join(", ");
  return (
    <Panel title="Clicks per country" id="land-h">
      <div className="flex flex-col gap-3">
        <div
          role="img"
          aria-label={`Click share: ${label}`}
          className="flex h-2.5 overflow-hidden rounded-full bg-background"
        >
          {rows.map((row, index) => (
            <span
              key={row.key}
              style={{
                width: `${total ? (row.clicks / total) * 100 : 0}%`,
                background: COUNTRY_COLORS[index],
              }}
            />
          ))}
        </div>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th scope="col" className="py-1.5 font-medium">
                Country
              </th>
              <th scope="col" className="py-1.5 text-right font-medium">
                Clicks
              </th>
              <th scope="col" className="py-1.5 text-right font-medium">
                Share
              </th>
              <th scope="col" className="py-1.5 text-right font-medium">
                Δ
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.key} className="border-t border-background">
                <td className="py-2">
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ background: COUNTRY_COLORS[index] }}
                    />
                    {row.name}
                  </span>
                </td>
                <td className="py-2 text-right tabular-nums">
                  {formatNumber(row.clicks)}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {total ? `${Math.round((row.clicks / total) * 100)}%` : "–"}
                </td>
                <td className="py-2 text-right">
                  <ChangePill change={row.clicksChange} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export function NotesPanel({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const key = ["project-notes", projectId];
  const notes = useQuery({
    queryKey: key,
    queryFn: () => getProjectNotes({ data: { projectId } }),
  });
  const [adding, setAdding] = useState(false);
  const [body, setBody] = useState("");
  const [noteDate, setNoteDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const add = useMutation({
    mutationFn: () => addProjectNote({ data: { projectId, noteDate, body } }),
    onSuccess: (list) => {
      queryClient.setQueryData(key, list);
      setBody("");
      setAdding(false);
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: (noteId: string) =>
      deleteProjectNote({ data: { projectId, noteId } }),
    onSuccess: (list) => queryClient.setQueryData(key, list),
  });
  const list = notes.data ?? [];
  return (
    <Panel
      title="My notes"
      id="notes-h"
      aside={
        list.length > 0 && !adding ? (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            + Note
          </Button>
        ) : null
      }
    >
      <div className="flex flex-col gap-3">
        {list.map((note) => (
          <div
            key={note.id}
            className="group flex items-start gap-2 border-t border-background pt-2.5 first:border-t-0 first:pt-0"
          >
            <div className="flex flex-1 flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">
                {new Date(`${note.noteDate}T00:00:00Z`).toLocaleDateString(
                  "en-GB",
                  {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    timeZone: "UTC",
                  },
                )}
              </span>
              <span className="text-sm leading-snug">{note.body}</span>
            </div>
            <button
              type="button"
              aria-label="Delete note"
              onClick={() => remove.mutate(note.id)}
              className="reveal-on-hover flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        {list.length === 0 && !adding ? (
          <div className="flex flex-col items-center gap-2 py-3 text-center">
            <span className="text-[13px] leading-relaxed text-muted-foreground">
              No notes yet. Write down what you changed, so you can see its
              effect on the trend.
            </span>
            <Button variant="outline" onClick={() => setAdding(true)}>
              + Add note
            </Button>
          </div>
        ) : null}
        {adding ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (body.trim()) add.mutate();
            }}
          >
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Date
              <input
                type="date"
                value={noteDate}
                onChange={(event) => setNoteDate(event.target.value)}
                className="min-h-10 rounded-lg border border-input bg-card px-2.5 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              What did you change?
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                maxLength={500}
                rows={3}
                autoFocus
                className="rounded-lg border border-input bg-card px-2.5 py-2 text-sm text-foreground"
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAdding(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                pending={add.isPending}
                disabled={!body.trim()}
              >
                Save note
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </Panel>
  );
}
