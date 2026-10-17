import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../auth";
import { Alert, Field } from "../components/ui";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { refresh } = useAuth();
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      await api.register(name.trim(), email.trim(), password);
      await refresh();
      navigate("/app");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page narrow">
      <h1>Create your account</h1>
      <p className="muted">Free. Your reports stay private by default.</p>
      {error ? <Alert kind="error">{error}</Alert> : null}
      <Alert kind="info">
        Email verification is <strong>not available yet</strong> — email delivery is
        blocked until an email provider is connected to this deployment. Your
        account works without verification.
      </Alert>
      <form onSubmit={submit} className="card">
        <Field label="Full name">
          <input className="input" type="text" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </Field>
        <Field label="Email">
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </Field>
        <Field label="Password" hint="At least 8 characters.">
          <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </Field>
        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? "Creating account…" : "Create account"}
        </button>
        <p className="small" style={{ marginTop: "1rem" }}>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </main>
  );
}
