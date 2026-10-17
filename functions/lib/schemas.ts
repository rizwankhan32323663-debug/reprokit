import { z } from "zod";

export const CATEGORIES = [
  "Website",
  "Mobile application",
  "Desktop application",
  "Login and authentication",
  "Payment",
  "File upload",
  "Performance",
  "Display and layout",
  "Navigation",
  "Other",
] as const;

export const SEVERITIES = ["Low", "Medium", "High", "Critical"] as const;
export const STATUSES = ["draft", "open", "in_progress", "resolved", "closed"] as const;

export const stepSchema = z.object({
  id: z.string().optional(),
  text: z.string().trim().min(1).max(2000),
  note: z.string().max(2000).optional().nullable(),
  expected_result: z.string().max(2000).optional().nullable(),
});

export const reportCreateSchema = z.object({
  title: z.string().trim().min(1).max(300),
  site_name: z.string().max(200).optional().nullable(),
  site_url: z.string().max(2000).optional().nullable(),
  category: z.enum(CATEGORIES).optional().nullable(),
  severity: z.enum(SEVERITIES).optional().nullable(),
  status: z.enum(STATUSES).optional(),
  description: z.string().max(20000).optional().nullable(),
  trying_to_do: z.string().max(10000).optional().nullable(),
  happened_instead: z.string().max(10000).optional().nullable(),
  expected_result: z.string().max(10000).optional().nullable(),
  actual_result: z.string().max(10000).optional().nullable(),
  error_message: z.string().max(10000).optional().nullable(),
  notes: z.string().max(20000).optional().nullable(),
  incident_at: z.number().int().positive().optional().nullable(),
  env_json: z.string().max(10000).optional().nullable(),
  workspace_id: z.string().max(100).optional().nullable(),
  assignee_id: z.string().max(100).optional().nullable(),
  steps: z.array(stepSchema).max(100).optional(),
});

export const reportUpdateSchema = reportCreateSchema.partial().extend({
  archived: z.boolean().optional(),
});

export const commentSchema = z.object({
  body: z.string().trim().min(1).max(10000),
});

export const workspaceCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
});

export const inviteSchema = z.object({
  email: z.string().email().max(320),
  role: z.enum(["admin", "member"]),
});

export const preferencesSchema = z.object({
  theme: z.enum(["light", "dark"]).optional(),
  email_notifications: z.boolean().optional(),
});

export const profileSchema = z.object({
  name: z.string().trim().min(1).max(200),
});

export function zodErrorMessage(e: z.ZodError): string {
  return e.issues.map((i) => `${i.path.join(".") || "field"}: ${i.message}`).join("; ");
}
