/**
 * Deterministic, rule-based report-quality engine. NOT AI: every suggestion
 * is produced by an explicit rule below, and each issue explains WHY it
 * appears. No user text is sent anywhere; scoring runs locally on the
 * report object.
 */
import type { Report, Step } from "./api";

export interface QualityIssue {
  id: string;
  severity: "error" | "warning" | "suggestion";
  message: string;
  why: string;
}

export interface QualityResult {
  score: number;
  issues: QualityIssue[];
  suggestedTitle: string | null;
  followUps: string[];
}

const GENERIC_TITLES = ["untitled", "issue", "bug", "problem", "error", "report", "help"];

export function assessQuality(
  report: Partial<Report>,
  steps: Step[],
  attachmentCount: number
): QualityResult {
  const issues: QualityIssue[] = [];
  let score = 100;
  const deduct = (n: number) => {
    score = Math.max(0, score - n);
  };

  const title = (report.title || "").trim();
  if (!title) {
    issues.push({ id: "title-missing", severity: "error", message: "Report title is missing.", why: "A clear title helps the reader understand the problem at a glance." });
    deduct(20);
  } else if (GENERIC_TITLES.includes(title.toLowerCase())) {
    issues.push({ id: "title-generic", severity: "warning", message: "Title is very generic.", why: "A specific title (site + what broke) makes the report findable and triageable." });
    deduct(8);
  }

  const description = (report.description || "").trim();
  if (description.length < 50) {
    issues.push({ id: "description-short", severity: "warning", message: "Problem description is very short.", why: "A few sentences about what you were doing when the problem appeared help others reproduce it." });
    deduct(12);
  }
  if (!((report.trying_to_do || "").trim())) {
    issues.push({ id: "trying-missing", severity: "warning", message: "“What were you trying to do?” is empty.", why: "Knowing the goal separates a bug from a misunderstanding." });
    deduct(8);
  }
  if (!((report.expected_result || "").trim())) {
    issues.push({ id: "expected-missing", severity: "warning", message: "Expected behavior is missing.", why: "Expected vs. actual is how a reader judges whether the behavior is wrong." });
    deduct(8);
  }
  if (!((report.actual_result || "").trim())) {
    issues.push({ id: "actual-missing", severity: "warning", message: "Actual behavior is missing.", why: "Actual behavior is the core evidence of the problem." });
    deduct(8);
  }

  if (steps.length === 0) {
    issues.push({ id: "steps-missing", severity: "error", message: "No reproduction steps.", why: "Without steps, nobody can reliably reproduce the problem." });
    deduct(20);
  } else {
    const empty = steps.filter((s) => !s.text.trim()).length;
    if (empty > 0) {
      issues.push({ id: "steps-empty", severity: "error", message: `${empty} step(s) are empty.`, why: "Empty steps break the reproduction sequence." });
      deduct(10 * empty);
    }
    const seen = new Set<string>();
    let dups = 0;
    for (const s of steps) {
      const key = s.text.trim().toLowerCase();
      if (key && seen.has(key)) dups++;
      seen.add(key);
    }
    if (dups > 0) {
      issues.push({ id: "steps-duplicate", severity: "warning", message: `${dups} duplicate step(s) found.`, why: "Duplicate steps confuse the reproduction sequence." });
      deduct(5 * dups);
    }
    const short = steps.filter((s) => s.text.trim().length > 0 && s.text.trim().length < 8).length;
    if (short > 0) {
      issues.push({ id: "steps-short", severity: "suggestion", message: `${short} step(s) look too brief to follow.`, why: "Each step should name one concrete action (what you clicked, typed, or selected)." });
      deduct(3 * short);
    }
  }

  const evidenceUseful = ["Website", "Display and layout", "File upload", "Payment"].includes(
    report.category || ""
  );
  if (attachmentCount === 0 && evidenceUseful) {
    issues.push({ id: "evidence-missing", severity: "suggestion", message: "No screenshot evidence attached.", why: "For visual or flow problems, a screenshot shows the problem faster than words." });
    deduct(6);
  }
  if (!report.env_json) {
    issues.push({ id: "env-missing", severity: "suggestion", message: "No environment details attached.", why: "Browser and device details help others reproduce device-specific problems." });
    deduct(4);
  }
  if ((report.category === "Login and authentication" || report.category === "Payment") && !((report.error_message || "").trim())) {
    issues.push({ id: "error-missing", severity: "suggestion", message: "No exact error message recorded.", why: "The exact error text is often the fastest clue for login and payment problems." });
    deduct(4);
  }

  // Suggested title: deterministic template from site + category + description.
  let suggestedTitle: string | null = null;
  if (!title || GENERIC_TITLES.includes(title.toLowerCase())) {
    const site = (report.site_name || "").trim();
    const cat = (report.category || "").trim();
    const first = description.split(/[.\n]/)[0]?.trim().slice(0, 60) || "problem";
    suggestedTitle = site ? `${site} — ${cat || "Issue"}: ${first}` : `${cat || "Issue"}: ${first}`;
  }

  const followUps: string[] = [];
  if (!((report.expected_result || "").trim())) followUps.push("What did you expect to happen instead?");
  if (steps.length === 0) followUps.push("Can you list the exact clicks or actions that lead to the problem?");
  if (attachmentCount === 0) followUps.push("Can you attach a screenshot showing the problem?");
  if (!report.env_json) followUps.push("Which browser and device did this happen on?");
  if (!((report.error_message || "").trim())) followUps.push("Did the page show an exact error message? If so, what did it say?");

  return { score, issues, suggestedTitle, followUps };
}
