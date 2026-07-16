import { Link } from "react-router-dom";
export function NotFoundPage() {
  return (
    <main className="empty-page">
      <span>404</span>
      <h1>We couldn’t find that page.</h1>
      <p>The page may have moved, or the product is no longer available.</p>
      <Link className="button primary" to="/">
        Back to home
      </Link>
    </main>
  );
}
