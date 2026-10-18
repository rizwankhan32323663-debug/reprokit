import React, { useEffect, useState } from "react";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../auth";
import { Alert, Field } from "../components/ui";
import { downloadBlob } from "../lib/format";

export default function Settings() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [theme, setTheme] = useState<"light" | "dark">((localStorage.getItem("reprokit-theme") as "light" | "dark") || "light");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) setName(user.name);
  }, [user]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMsg("");
    try {
      await api.settings.profile(name.trim());
      await refresh();
      setMsg("Profile saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save profile.");
    }
  };

  const saveTheme = async (t: "light" | "dark") => {
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("reprokit-theme", t);
    try {
      await api.settings.preferences({ theme: t });
    } catch {
      // Theme still applies locally; server preference is best-effort.
    }
  };

  const exportData = async () => {
    setError("");
    try {
      const data = await api.settings.exportData();
      downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), "reprokit-my-data.json");
      setMsg("Your data export downloaded.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Export failed.");
    }
  };

  return (
    <main className="page narrow">
      <h1>Settings</h1>
      {msg ? <Alert kind="success">{msg}</Alert> : null}
      {error ? <Alert kind="error">{error}</Alert> : null}

      <section className="card">
        <h2>Profile</h2>
        <form onSubmit={saveProfile}>
          <Field label="Full name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <button className="btn btn-primary" type="submit">Save profile</button>
        </form>
      </section>

      <section className="card">
        <h2>Appearance</h2>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className={`btn ${theme === "light" ? "btn-primary" : ""}`} onClick={() => void saveTheme("light")}>Light</button>
          <button className={`btn ${theme === "dark" ? "btn-primary" : ""}`} onClick={() => void saveTheme("dark")}>Dark</button>
        </div>
      </section>

      <section className="card">
        <h2>Your data</h2>
        <p className="small muted">Download a JSON copy of your reports, comments, and workspace memberships.</p>
        <button className="btn" onClick={() => void exportData()}>Export my data (JSON)</button>
      </section>
    </main>
  );
}
