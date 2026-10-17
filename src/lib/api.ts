export interface User {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON response
  }
  if (!res.ok) {
    const msg =
      (data as { error?: string } | null)?.error || `Request failed (${res.status})`;
    throw new ApiError(msg, res.status);
  }
  return data as T;
}

export const api = {
  me: () => req<{ user: User }>("/api/me"),
  register: (name: string, email: string, password: string) =>
    req("/api/auth/sign-up/email", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),
  login: (email: string, password: string) =>
    req("/api/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => req("/api/auth/sign-out", { method: "POST", body: JSON.stringify({}) }),
  forgotPassword: (email: string) =>
    req("/api/auth/request-password-reset", {
      method: "POST",
      body: JSON.stringify({ email, redirectTo: "/reset-password" }),
    }),
  resetPassword: (token: string, newPassword: string) =>
    req("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, newPassword }),
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    req("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword, revokeOtherSessions: true }),
    }),
  dashboard: () => req<Record<string, unknown>>("/api/dashboard"),
  reports: {
    list: (params: Record<string, string> = {}) => {
      const qs = new URLSearchParams(params).toString();
      return req<{ reports: Report[]; total: number; page: number; limit: number }>(
        `/api/reports${qs ? `?${qs}` : ""}`
      );
    },
    create: (body: unknown) =>
      req<{ id: string }>("/api/reports", { method: "POST", body: JSON.stringify(body) }),
    get: (id: string) => req<ReportDetail>(`/api/reports/${id}`),
    update: (id: string, body: unknown) =>
      req(`/api/reports/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    remove: (id: string) => req(`/api/reports/${id}`, { method: "DELETE" }),
    duplicate: (id: string) => req<{ id: string }>(`/api/reports/${id}/duplicate`, { method: "POST", body: JSON.stringify({}) }),
    comments: {
      list: (id: string) => req<{ comments: Comment[] }>(`/api/reports/${id}/comments`),
      add: (id: string, body: string) =>
        req(`/api/reports/${id}/comments`, { method: "POST", body: JSON.stringify({ body }) }),
    },
    attachments: {
      // Raw binary upload (NOT FormData): bytes in the body, metadata in
      // headers. Base64/multipart would inflate the payload and burn the
      // Workers Free CPU budget. See functions/api/reports/[id]/attachments.ts.
      upload: async (id: string, file: File, caption: string) => {
        const res = await fetch(`/api/reports/${id}/attachments`, {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": file.type,
            "X-Filename": encodeURIComponent(file.name),
            "X-Caption": encodeURIComponent(caption),
          },
          body: file,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new ApiError((data as { error?: string }).error || "Upload failed", res.status);
        return data as { id: string };
      },
      uploadRedacted: async (attachmentId: string, file: File, caption: string) => {
        const res = await fetch(`/api/attachments/${attachmentId}/redacted`, {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": file.type,
            "X-Filename": encodeURIComponent(file.name),
            "X-Caption": encodeURIComponent(caption),
          },
          body: file,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new ApiError((data as { error?: string }).error || "Upload failed", res.status);
        return data as { id: string };
      },
      remove: (attachmentId: string) =>
        req(`/api/attachments/${attachmentId}`, { method: "DELETE" }),
      downloadUrl: (attachmentId: string) => `/api/attachments/${attachmentId}`,
    },
    share: {
      create: (id: string, expires_at?: number | null) =>
        req<{ id: string; token: string; url: string }>(`/api/reports/${id}/share`, {
          method: "POST",
          body: JSON.stringify({ expires_at: expires_at ?? null }),
        }),
      revoke: (id: string, linkId: string) =>
        req(`/api/reports/${id}/share/${linkId}`, { method: "DELETE" }),
      list: (id: string) => req<{ links: ShareLink[] }>(`/api/reports/${id}/share`),
    },
  },
  storage: {
    status: (workspaceId?: string | null) =>
      req<{
        provider: "kv" | "r2" | "none";
        configured: boolean;
        quota: {
          user: { usedBytes: number; maxBytes: number; files: number; maxFiles: number };
          workspace: { usedBytes: number; maxBytes: number; files: number; maxFiles: number } | null;
        };
      }>(`/api/storage${workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : ""}`),
  },
  shareView: (token: string) => req<PublicReport>(`/api/share/${token}`),
  workspaces: {
    list: () => req<{ workspaces: Workspace[] }>("/api/workspaces"),
    create: (name: string) =>
      req<{ id: string }>("/api/workspaces", { method: "POST", body: JSON.stringify({ name }) }),
    get: (id: string) => req<WorkspaceDetail>(`/api/workspaces/${id}`),
    update: (id: string, body: unknown) =>
      req(`/api/workspaces/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    remove: (id: string) => req(`/api/workspaces/${id}`, { method: "DELETE" }),
    invite: (id: string, email: string, role: "admin" | "member") =>
      req<{ code: string; link: string }>(`/api/workspaces/${id}/members`, {
        method: "POST",
        body: JSON.stringify({ email, role }),
      }),
    removeMember: (id: string, userId: string) =>
      req(`/api/workspaces/${id}/members/${userId}`, { method: "DELETE" }),
  },
  invites: {
    accept: (code: string) => req<{ workspace_id: string }>(`/api/invites/${code}`, { method: "POST", body: JSON.stringify({}) }),
  },
  comments: {
    update: (id: string, body: string) =>
      req(`/api/comments/${id}`, { method: "PUT", body: JSON.stringify({ body }) }),
    remove: (id: string) => req(`/api/comments/${id}`, { method: "DELETE" }),
  },
  notifications: {
    list: () => req<{ notifications: Notification[] }>("/api/notifications"),
    markRead: (id: string) => req(`/api/notifications/${id}/read`, { method: "POST", body: JSON.stringify({}) }),
    markAllRead: () => req("/api/notifications/read-all", { method: "POST", body: JSON.stringify({}) }),
  },
  activity: (reportId?: string, workspaceId?: string) => {
    const qs = new URLSearchParams();
    if (reportId) qs.set("report_id", reportId);
    if (workspaceId) qs.set("workspace_id", workspaceId);
    return req<{ events: ActivityEvent[] }>(`/api/activity?${qs.toString()}`);
  },
  settings: {
    profile: (name: string) => req("/api/settings/profile", { method: "PUT", body: JSON.stringify({ name }) }),
    preferences: (body: { theme?: "light" | "dark"; email_notifications?: boolean }) =>
      req("/api/settings/preferences", { method: "PUT", body: JSON.stringify(body) }),
    exportData: () => req("/api/settings/export"),
    deleteAccount: () => req("/api/settings/account", { method: "DELETE" }),
  },
  labels: {
    list: () => req<{ labels: Label[] }>("/api/labels"),
    create: (name: string, color: string, workspace_id?: string | null) =>
      req<{ id: string }>("/api/labels", { method: "POST", body: JSON.stringify({ name, color, workspace_id: workspace_id ?? null }) }),
    assign: (reportId: string, labelId: string) =>
      req(`/api/reports/${reportId}/labels`, { method: "POST", body: JSON.stringify({ label_id: labelId }) }),
    unassign: (reportId: string, labelId: string) =>
      req(`/api/reports/${reportId}/labels/${labelId}`, { method: "DELETE" }),
  },
};

export interface Report {
  id: string;
  owner_id: string;
  workspace_id: string | null;
  assignee_id: string | null;
  title: string;
  site_name: string | null;
  site_url: string | null;
  category: string | null;
  severity: string | null;
  status: string;
  description: string | null;
  trying_to_do: string | null;
  happened_instead: string | null;
  expected_result: string | null;
  actual_result: string | null;
  error_message: string | null;
  notes: string | null;
  incident_at: number | null;
  env_json: string | null;
  archived: number;
  created_at: number;
  updated_at: number;
  owner_name?: string;
}

export interface Step {
  id?: string;
  text: string;
  note?: string | null;
  expected_result?: string | null;
}

export interface Attachment {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  caption: string | null;
  is_redacted: number;
  created_at: number;
}

export interface Comment {
  id: string;
  report_id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: number;
  updated_at: number;
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface ReportDetail {
  report: Report;
  steps: Step[];
  attachments: Attachment[];
  comments: Comment[];
  labels: Label[];
}

export interface ShareLink {
  id: string;
  expires_at: number | null;
  revoked: number;
  created_at: number;
}

export interface PublicReport {
  report: {
    title: string;
    site_name: string | null;
    site_url: string | null;
    category: string | null;
    severity: string | null;
    status: string;
    description: string | null;
    trying_to_do: string | null;
    happened_instead: string | null;
    expected_result: string | null;
    actual_result: string | null;
    error_message: string | null;
    notes: string | null;
    incident_at: number | null;
    env_json: string | null;
    created_at: number;
    updated_at: number;
  };
  steps: Step[];
  attachments: { id: string; filename: string; caption: string | null; is_redacted: number }[];
  shareToken: string;
}

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  created_at: number;
  updated_at: number;
  role?: string;
}

export interface WorkspaceDetail {
  workspace: Workspace;
  members: { user_id: string; name: string; email: string; role: string }[];
  invites: { id: string; email: string; role: string; expires_at: number; accepted_at: number | null }[];
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: number;
  created_at: number;
}

export interface ActivityEvent {
  id: string;
  report_id: string | null;
  workspace_id: string | null;
  actor_id: string;
  actor_name: string;
  type: string;
  detail: string | null;
  created_at: number;
}
