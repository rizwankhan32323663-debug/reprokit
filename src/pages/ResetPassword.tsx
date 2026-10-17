import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError, api } from "../lib/api";
import { Alert, Field } from "../components/ui";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Reset failed. The link may have expired or already been used.");
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <main className="page narrow">
        <h1>Reset your password</h1>
        <Alert kind="error">This reset link is missing its token. Use the full link from the password-reset email.</Alert>
        <p>
          <Link to="/forgot-password">Request a new reset link</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="page narrow">
      <h1>Reset your password</h1>
      {done ? (
        <>
          <Alert kind="success">Your password was reset. You can now log in with the new password.</Alert>
          <p>
            <Link to="/login">Log in</Link>
          </p>
        </>
      ) : (
        <form onSubmit={submit} className="card">
          {error ? <Alert kind="error">{error}</Alert> : null}
          <Field label="New password" hint="At least 8 characters. Reset links expire and can only be used once.">
            <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </Field>
          <Field label="Confirm new password">
            <input className="input" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </Field>
          <button className="btn btn-primary" disabled={busy} type="submit">
            {busy ? "Resetting…" : "Reset password"}
          </button>
        </form>
      )}
    </main>
  );
}
