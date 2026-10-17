import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <main className="page narrow">
      <h1>Page not found (404)</h1>
      <p className="muted">The page you are looking for does not exist or you do not have access to it.</p>
      <p>
        <Link to="/">Go home</Link> · <Link to="/app">Dashboard</Link> · <Link to="/help">Help</Link>
      </p>
    </main>
  );
}
