import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../auth";
import { Alert, Field } from "../components/ui";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { refresh } = useAuth();
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.login(email.trim(), password);
      await refresh();
      navigate("/app");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page narrow">
      <h1>Log in</h1>
      <p className="muted">Welcome back to ReproKit.</p>
      {error ? <Alert kind="error">{error}</Alert> : null}
      <form onSubmit={submit} className="card">
        <Field label="Email">
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </Field>
        <Field label="Password">
          <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </Field>
        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? "Logging in…" : "Log in"}
        </button>
        <p className="small" style={{ marginTop: "1rem" }}>
          <Link to="/forgot-password">Forgot your password?</Link>
          {" · "}
          <Link to="/register">Create an account</Link>
        </p>
      </form>
    </main>
  );
}
