import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { useProject } from "@/client/features/seo-app/hooks";
import { PageTitle } from "@/client/features/seo-app/ui";

const TAB_CLASS =
  "flex min-h-9 items-center rounded-lg border px-3.5 text-sm whitespace-nowrap no-underline";

/** The Keywords screen's title with its two views: ideas and questions. */
export function KeywordsHeader({
  projectId,
  active,
  keyword,
  backLink,
}: {
  projectId: string;
  active: "ideas" | "questions";
  /** Carried across so switching views keeps the seed keyword. */
  keyword?: string;
  backLink?: ReactNode;
}) {
  const project = useProject(projectId);
  const tab = (key: "ideas" | "questions") =>
    cn(
      TAB_CLASS,
      key === active
        ? "border-border bg-card font-semibold text-foreground shadow-xs"
        : "border-transparent text-muted-foreground hover:text-foreground",
    );
  return (
    <div className="flex flex-col gap-4">
      {backLink}
      <PageTitle
        title="Keywords"
        domain={project?.domain}
        subtitle="Ideas and questions around a seed keyword"
      />
      <nav
        aria-label="Keyword views"
        className="flex gap-0.5 self-start rounded-[10px] border border-border bg-secondary p-[3px]"
      >
        <Link
          to="/p/$projectId/keywords"
          params={{ projectId }}
          search={keyword ? { q: keyword } : {}}
          aria-current={active === "ideas" ? "page" : undefined}
          className={tab("ideas")}
        >
          Keyword ideas
        </Link>
        <Link
          to="/p/$projectId/questions"
          params={{ projectId }}
          search={keyword ? { q: keyword } : {}}
          aria-current={active === "questions" ? "page" : undefined}
          className={tab("questions")}
        >
          Questions
        </Link>
      </nav>
    </div>
  );
}
