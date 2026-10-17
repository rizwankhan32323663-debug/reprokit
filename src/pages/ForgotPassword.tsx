import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, api } from "../lib/api";
import { Alert, Field } from "../components/ui";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.forgotPassword(email.trim());
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Request failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page narrow">
      <h1>Forgot your password?</h1>
      {done ? (
        <>
          <Alert kind="warning">
            Password reset was requested, but <strong>email delivery is blocked</strong> on
            this ReproKit deployment — no email provider is connected yet, so no reset
            email can be sent. The reset flow exists, but delivery is blocked until an
            email provider is configured (see Help for setup steps).
          </Alert>
          <p>
            <Link to="/login">Back to login</Link>
          </p>
        </>
      ) : (
        <form onSubmit={submit} className="card">
          {error ? <Alert kind="error">{error}</Alert> : null}
          <Alert kind="info">
            Email delivery is currently <strong>blocked</strong> (no email provider
            configured). Submitting this form records a reset request, but no email
            will arrive until a provider is connected.
          </Alert>
          <Field label="Email">
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          <button className="btn btn-primary" disabled={busy} type="submit">
            {busy ? "Requesting…" : "Request password reset"}
          </button>
        </form>
      )}
    </main>
  );
}
