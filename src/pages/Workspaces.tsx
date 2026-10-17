import React, { useEffect, useState } from "react";
import { ApiError, api, type Workspace, type WorkspaceDetail } from "../lib/api";
import { useAuth } from "../auth";
import { Alert, Field } from "../components/ui";

export default function Workspaces() {
  const { user } = useAuth();
  const [list, setList] = useState<Workspace[]>([]);
  const [selected, setSelected] = useState<WorkspaceDetail | null>(null);
  const [name, setName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviteLink, setInviteLink] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    try {
      const res = await api.workspaces.list();
      setList(res.workspaces);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load workspaces.");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const open = async (id: string) => {
    try {
      setSelected(await api.workspaces.get(id));
      setInviteLink("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load workspace.");
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api.workspaces.create(name.trim());
      setName("");
      setNotice("Workspace created.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create workspace.");
    }
  };

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setError("");
    setNotice("");
    try {
      const res = await api.workspaces.invite(selected.workspace.id, inviteEmail.trim(), inviteRole);
      setInviteLink(res.link);
      setInviteEmail("");
      setNotice("Invite created. Share the link below — no invite email is sent (email delivery is blocked until a provider is connected).");
      await open(selected.workspace.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create invite.");
    }
  };

  const removeMember = async (userId: string) => {
    if (!selected) return;
    if (!window.confirm("Remove this member from the workspace?")) return;
    try {
      await api.workspaces.removeMember(selected.workspace.id, userId);
      await open(selected.workspace.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove member.");
    }
  };

  const rename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    try {
      await api.workspaces.update(selected.workspace.id, { name: selected.workspace.name });
      setNotice("Workspace renamed.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to rename workspace.");
    }
  };

  return (
    <main className="page">
      <h1>Workspaces</h1>
      {error ? <Alert kind="error">{error}</Alert> : null}
      {notice ? <Alert kind="success">{notice}</Alert> : null}

      <div className="grid grid-2">
        <section className="card">
          <h2>Your workspaces</h2>
          {list.length === 0 ? (
            <p className="muted">No workspaces yet. Create one to collaborate with a team.</p>
          ) : (
            <ul>
              {list.map((w) => (
                <li key={w.id}>
                  <button className="btn btn-ghost" onClick={() => void open(w.id)}>{w.name}</button>
                  <span className="small faint"> ({w.role})</span>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={create} style={{ marginTop: "1rem" }}>
            <Field label="New workspace name">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Support team" />
            </Field>
            <button className="btn btn-primary" type="submit">Create workspace</button>
          </form>
        </section>

        <section className="card">
          {selected ? (
            <>
              <form onSubmit={rename}>
                <Field label="Workspace name">
                  <input
                    className="input"
                    value={selected.workspace.name}
                    onChange={(e) => setSelected({ ...selected, workspace: { ...selected.workspace, name: e.target.value } })}
                  />
                </Field>
                <button className="btn" type="submit">Rename</button>
              </form>
              <h3>Members</h3>
              <ul>
                {selected.members.map((m) => (
                  <li key={m.user_id}>
                    {m.name} ({m.email}) — {m.role}
                    {m.user_id !== user?.id && selected.workspace.owner_id === user?.id ? (
                      <button className="btn btn-sm" style={{ marginLeft: "0.5rem" }} onClick={() => void removeMember(m.user_id)}>Remove</button>
                    ) : null}
                  </li>
                ))}
              </ul>
              <h3>Invite a member</h3>
              <form onSubmit={invite}>
                <Field label="Email">
                  <input className="input" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
                </Field>
                <Field label="Role">
                  <select className="select" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as "admin" | "member")}>
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </Field>
                <button className="btn btn-primary" type="submit">Create invite</button>
              </form>
              {inviteLink ? (
                <div className="alert alert-info">
                  Invite link (share it manually — no email is sent):
                  <div style={{ wordBreak: "break-all" }}><a href={inviteLink}>{inviteLink}</a></div>
                </div>
              ) : null}
              <h3>Pending invites</h3>
              {selected.invites.length === 0 ? <p className="muted">None.</p> : (
                <ul>
                  {selected.invites.map((inv) => (
                    <li key={inv.id}>{inv.email} — {inv.role} — expires {new Date(inv.expires_at).toLocaleString()}</li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="muted">Select a workspace to manage members and invites.</p>
          )}
        </section>
      </div>
    </main>
  );
}
