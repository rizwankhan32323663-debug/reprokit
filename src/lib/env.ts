/**
 * Opt-in environment diagnostics. Only reads standard browser APIs, only
 * when the user explicitly clicks "Add environment details", and the
 * collected fields are shown for review/removal before being attached.
 * Never collects location, contacts, history, cookies, or passwords.
 */
export interface EnvField {
  key: string;
  label: string;
  value: string;
}

export function collectEnvironment(includeCurrentUrl: boolean): EnvField[] {
  const fields: EnvField[] = [];
  fields.push({ key: "user_agent", label: "Browser user-agent", value: navigator.userAgent });
  fields.push({ key: "language", label: "Language", value: navigator.language });
  try {
    fields.push({ key: "timezone", label: "Time zone", value: Intl.DateTimeFormat().resolvedOptions().timeZone });
  } catch {
    // Intl unavailable — skip rather than guess.
  }
  fields.push({ key: "screen", label: "Screen dimensions", value: `${window.screen.width} × ${window.screen.height}` });
  fields.push({ key: "viewport", label: "Viewport dimensions", value: `${window.innerWidth} × ${window.innerHeight}` });
  fields.push({ key: "platform", label: "Platform hint", value: (navigator as Navigator & { platform?: string }).platform || "unknown" });
  if (includeCurrentUrl) {
    fields.push({ key: "current_url", label: "Current page URL (ReproKit)", value: window.location.href });
  }
  return fields;
}
