/**
 * ── Theme Toggle ───────────────────────────────────────────────────────
 *
 * Switches between dark (default) and light theme by toggling the
 * .theme-light class on <html>. Persists choice in localStorage.
 */

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "commenda-theme";

export function ThemeToggle() {
  const [isLight, setIsLight] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "light";
    } catch {
      return false;
    }
  });

  // Apply class on mount and whenever isLight changes
  useEffect(() => {
    const root = document.documentElement;
    if (isLight) {
      root.classList.add("theme-light");
    } else {
      root.classList.remove("theme-light");
    }
    try {
      localStorage.setItem(STORAGE_KEY, isLight ? "light" : "dark");
    } catch {
      // localStorage unavailable
    }

    // Broadcast to non-React consumers (globe scene)
    document.dispatchEvent(
      new CustomEvent("theme-change", { detail: { isLight } }),
    );
  }, [isLight]);

  const toggle = useCallback(() => setIsLight((v) => !v), []);

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      title={isLight ? "Dark mode" : "Light mode"}
    >
      {isLight ? (
        // Moon icon (switch to dark)
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        // Sun icon (switch to light)
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      )}
    </button>
  );
}
