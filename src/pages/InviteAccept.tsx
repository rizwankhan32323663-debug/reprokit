import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError, api } from "../lib/api";
import { Alert } from "../components/ui";

export default function InviteAccept() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    if (!code) return;
    setBusy(true);
    setError("");
    try {
      await api.invites.accept(code);
      navigate("/app/workspaces");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "This invite is invalid, expired, or already used.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page narrow">
      <h1>Workspace invite</h1>
      <p className="muted">You were invited to join a ReproKit workspace.</p>
      {error ? <Alert kind="error">{error}</Alert> : null}
      <button className="btn btn-primary" disabled={busy} onClick={() => void accept()}>
        {busy ? "Joining…" : "Accept invite"}
      </button>
    </main>
  );
}
