/**
 * ── Error banner component ─────────────────────────────────────────────
 *
 * Displays a friendly error message when data fails to load.
 * Used instead of crashing the app.
 */

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

const FRIENDLY_CONNECTION_MESSAGE =
  "Can't reach the app. Start the dev server (npm run dev or .\\start-dev.ps1), then open http://localhost:5173 in your browser.";

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  // Never show raw "connection failed" or similar; always show friendly instructions.
  const displayMessage =
    /connection\s*failed|failed\s*to\s*fetch|load\s*failed|networkerror|refused|net::err/i.test(message) ||
    (message.toLowerCase().includes("connection") && message.toLowerCase().includes("fail"))
      ? FRIENDLY_CONNECTION_MESSAGE
      : message;
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/50fbe4fa-ba9a-46ba-9d26-eb9e995210d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ErrorBanner.tsx:render',message:'ErrorBanner message shown',data:{message:message.substring(0,120)},timestamp:Date.now(),hypothesisId:'A',runId:'run1'})}).catch(()=>{});
  // #endregion
  return (
    <div className="error-banner" role="alert">
      <span className="error-banner__icon">⚠</span>
      <p className="error-banner__message">{displayMessage}</p>
      {onRetry && (
        <button
          type="button"
          className="error-banner__retry"
          onClick={onRetry}
        >
          Retry
        </button>
      )}
    </div>
  );
}
