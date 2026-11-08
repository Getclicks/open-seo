import { createFileRoute } from "@tanstack/react-router";
import { QuestionExplorerPage } from "@/client/features/questions/QuestionExplorerPage";
import { pageHead } from "@/client/lib/pageHead";
import { questionExplorerSearchSchema } from "@/types/schemas/keywords";

export const Route = createFileRoute("/_app/p/$projectId/questions")({
  head: () => pageHead("Question Explorer"),
  validateSearch: questionExplorerSearchSchema,
  // The project switcher keeps this page; the form draft must not follow.
  remountDeps: ({ params }) => params.projectId,
  component: QuestionExplorerRoute,
});

function QuestionExplorerRoute() {
  const { projectId } = Route.useParams();
  const search = Route.useSearch();
  return <QuestionExplorerPage projectId={projectId} search={search} />;
}
