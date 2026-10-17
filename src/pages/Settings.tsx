import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../auth";
import { Alert, Field } from "../components/ui";
import { downloadBlob } from "../lib/format";

export default function Settings() {
  const { user, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">((localStorage.getItem("reprokit-theme") as "light" | "dark") || "light");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);

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

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMsg("");
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setMsg("Password changed. Other sessions were signed out.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to change password.");
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

  const deleteAccount = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    try {
      await api.settings.deleteAccount();
      await logout();
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Account deletion failed.");
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
          <Field label="Email">
            <input className="input" value={user?.email || ""} disabled />
          </Field>
          <button className="btn btn-primary" type="submit">Save profile</button>
        </form>
      </section>

      <section className="card">
        <h2>Password</h2>
        <form onSubmit={changePassword}>
          <Field label="Current password">
            <input className="input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" />
          </Field>
          <Field label="New password" hint="At least 8 characters.">
            <input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required autoComplete="new-password" />
          </Field>
          <button className="btn btn-primary" type="submit">Change password</button>
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

      <section className="card">
        <h2>Delete account</h2>
        <p className="small muted">
          Deleting your account permanently removes your account, reports, comments, and
          attachments, and removes you from your workspaces. Workspaces you own are
          transferred to remaining members where possible. This cannot be undone.
        </p>
        {deleteConfirm ? (
          <div>
            <Alert kind="warning">Are you sure? This permanently deletes your account and data.</Alert>
            <button className="btn btn-danger" onClick={() => void deleteAccount()}>Yes, delete my account</button>{" "}
            <button className="btn" onClick={() => setDeleteConfirm(false)}>Cancel</button>
          </div>
        ) : (
          <button className="btn btn-danger" onClick={() => setDeleteConfirm(true)}>Delete my account</button>
        )}
      </section>
    </main>
  );
}
