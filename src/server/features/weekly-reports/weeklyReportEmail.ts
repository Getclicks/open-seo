import { getOptionalEnvValue } from "@/server/lib/runtime-env";
import type { ReportAction } from "@/server/features/weekly-reports/weeklyReportBuilder";

const RESEND_URL = "https://api.resend.com/emails";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Whether this installation can send report emails at all. */
export async function canSendReportEmail() {
  return Boolean(
    (await getOptionalEnvValue("RESEND_API_KEY")) &&
    (await getOptionalEnvValue("WEEKLY_REPORT_FROM")),
  );
}

/**
 * Sends the report summary with a link into the app, through Resend.
 * Returns false when email isn't configured; throws when Resend refuses.
 */
export async function sendReportEmail(input: {
  to: string[];
  storeName: string;
  periodLabel: string;
  summary: string;
  actions: ReportAction[];
  reportUrl: string | null;
}): Promise<boolean> {
  const apiKey = await getOptionalEnvValue("RESEND_API_KEY");
  const from = await getOptionalEnvValue("WEEKLY_REPORT_FROM");
  if (!apiKey || !from || input.to.length === 0) return false;
  const actions = input.actions
    .map(
      (action, index) =>
        `<li style="margin:0 0 8px"><strong>${index + 1}. ${escapeHtml(action.title)}</strong>${
          action.detail
            ? `<br><span style="color:#4B4F54">${escapeHtml(action.detail)}</span>`
            : ""
        }</li>`,
    )
    .join("");
  const html = `<div style="font-family:Inter,Arial,sans-serif;color:#0E0E10;max-width:560px">
<p style="color:#6B6F73;font-size:13px;margin:0 0 4px">${escapeHtml(input.periodLabel)}</p>
<h1 style="font-size:20px;margin:0 0 16px">Weekly report: ${escapeHtml(input.storeName)}</h1>
<p style="font-size:15px;line-height:1.6">${escapeHtml(input.summary)}</p>
${actions ? `<h2 style="font-size:15px;margin:20px 0 8px">Actions</h2><ol style="padding:0;list-style:none;font-size:14px;line-height:1.5">${actions}</ol>` : ""}
${input.reportUrl ? `<p><a href="${escapeHtml(input.reportUrl)}" style="display:inline-block;background:#39C7D6;color:#0E0E10;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Open the full report</a></p>` : ""}
</div>`;
  const response = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: `Weekly SEO report: ${input.storeName} (${input.periodLabel})`,
      html,
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Resend refused the report email (${response.status}): ${(await response.text()).slice(0, 200)}`,
    );
  }
  return true;
}
