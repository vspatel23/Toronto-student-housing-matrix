import { Link } from "react-router-dom";

function NotFound() {
  return (
    <section className="state-panel empty-state" aria-labelledby="not-found-title">
      <h1 id="not-found-title">Page not found</h1>
      <p>This page doesn't exist, or the link may be out of date.</p>
      <Link to="/" className="details-button">
        Back to Dashboard
      </Link>
    </section>
  );
}

export default NotFound;
