import { WeeklyReportRepository } from "@/server/features/weekly-reports/WeeklyReportRepository";

/** Dashboard notes: what was changed on the site, and when. */
async function list(projectId: string) {
  return WeeklyReportRepository.listNotes(projectId, 20);
}

async function add(input: {
  projectId: string;
  noteDate: string;
  body: string;
}) {
  await WeeklyReportRepository.addNote(input);
  return list(input.projectId);
}

async function remove(input: { projectId: string; noteId: string }) {
  await WeeklyReportRepository.deleteNote(input.projectId, input.noteId);
  return list(input.projectId);
}

export const ProjectNotesService = { list, add, remove };
