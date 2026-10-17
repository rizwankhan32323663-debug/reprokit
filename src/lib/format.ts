import type { Attachment, Report, Step } from "./api";

export function slugifyFilename(title: string): string {
  const s = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s || "reprokit-report";
}

function fmtDate(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

export function reportToMarkdown(
  report: Report,
  steps: Step[],
  attachments: Attachment[]
): string {
  const lines: string[] = [];
  lines.push(`# ${report.title || "Untitled report"}`);
  lines.push("");
  lines.push(`- **Status:** ${report.status}`);
  if (report.severity) lines.push(`- **Severity:** ${report.severity}`);
  if (report.category) lines.push(`- **Category:** ${report.category}`);
  if (report.site_name) lines.push(`- **Site / app:** ${report.site_name}`);
  if (report.site_url) lines.push(`- **URL:** ${report.site_url}`);
  if (report.incident_at) lines.push(`- **Incident:** ${fmtDate(report.incident_at)}`);
  lines.push(`- **Created:** ${fmtDate(report.created_at)}`);
  lines.push(`- **Updated:** ${fmtDate(report.updated_at)}`);
  lines.push("");
  if (report.description) lines.push(`## Problem description\n\n${report.description}\n`);
  if (report.trying_to_do) lines.push(`## What I was trying to do\n\n${report.trying_to_do}\n`);
  if (report.happened_instead) lines.push(`## What happened instead\n\n${report.happened_instead}\n`);
  if (report.expected_result) lines.push(`## Expected behavior\n\n${report.expected_result}\n`);
  if (report.actual_result) lines.push(`## Actual behavior\n\n${report.actual_result}\n`);
  if (report.error_message) lines.push(`## Exact error message\n\n\`\`\`\n${report.error_message}\n\`\`\`\n`);
  if (report.notes) lines.push(`## Additional notes\n\n${report.notes}\n`);
  if (steps.length) {
    lines.push("## Reproduction steps\n");
    steps.forEach((s, i) => {
      lines.push(`${i + 1}. ${s.text}`);
      if (s.note) lines.push(`   - Note: ${s.note}`);
      if (s.expected_result) lines.push(`   - Expected: ${s.expected_result}`);
    });
    lines.push("");
  }
  if (report.env_json) {
    lines.push("## Environment details\n");
    try {
      const env = JSON.parse(report.env_json) as { label: string; value: string }[];
      for (const f of env) lines.push(`- **${f.label}:** ${f.value}`);
    } catch {
      lines.push(report.env_json);
    }
    lines.push("");
  }
  if (attachments.length) {
    lines.push("## Evidence\n");
    for (const a of attachments) {
      lines.push(`- ${a.filename}${a.caption ? ` — ${a.caption}` : ""}${a.is_redacted ? " (redacted copy)" : ""}`);
    }
    lines.push("");
  }
  lines.push("---\n\nGenerated with ReproKit.");
  return lines.join("\n");
}

export function reportToJSON(report: Report, steps: Step[], attachments: Attachment[]): string {
  return JSON.stringify(
    {
      title: report.title,
      status: report.status,
      severity: report.severity,
      category: report.category,
      site_name: report.site_name,
      site_url: report.site_url,
      incident_at: report.incident_at,
      description: report.description,
      trying_to_do: report.trying_to_do,
      happened_instead: report.happened_instead,
      expected_result: report.expected_result,
      actual_result: report.actual_result,
      error_message: report.error_message,
      notes: report.notes,
      env: report.env_json ? JSON.parse(report.env_json) : null,
      steps,
      attachments: attachments.map((a) => ({
        filename: a.filename,
        caption: a.caption,
        content_type: a.content_type,
        size_bytes: a.size_bytes,
        is_redacted: a.is_redacted,
      })),
      created_at: report.created_at,
      updated_at: report.updated_at,
    },
    null,
    2
  );
}

export function reportToText(report: Report, steps: Step[]): string {
  const lines: string[] = [];
  lines.push(report.title || "Untitled report");
  lines.push(`Status: ${report.status}${report.severity ? ` | Severity: ${report.severity}` : ""}`);
  if (report.site_name) lines.push(`Site / app: ${report.site_name}`);
  if (report.site_url) lines.push(`URL: ${report.site_url}`);
  if (report.description) lines.push(`\nProblem: ${report.description}`);
  if (report.trying_to_do) lines.push(`\nTrying to do: ${report.trying_to_do}`);
  if (report.happened_instead) lines.push(`\nHappened instead: ${report.happened_instead}`);
  if (report.expected_result) lines.push(`\nExpected: ${report.expected_result}`);
  if (report.actual_result) lines.push(`\nActual: ${report.actual_result}`);
  if (report.error_message) lines.push(`\nError: ${report.error_message}`);
  if (steps.length) {
    lines.push("\nSteps to reproduce:");
    steps.forEach((s, i) => lines.push(`${i + 1}. ${s.text}`));
  }
  return lines.join("\n");
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function copyTextWithFallback(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}
