/**
 * ── Error banner component ─────────────────────────────────────────────
 *
 * Displays a friendly error message when data fails to load.
 */

import { memo } from "react";

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorBanner = memo(function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div className="error-banner" role="alert">
      <span className="error-banner__icon">⚠</span>
      <p className="error-banner__message">{message}</p>
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
});
