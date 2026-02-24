/**
 * ── Theme Injector ─────────────────────────────────────────────────────
 *
 * Called once at app boot. Only injects tokens from tokens.generated.json
 * as inline CSS properties. Default tokens are defined in theme.css via
 * :root and .theme-light classes — we must NOT override those with inline
 * styles or the light/dark toggle would stop working (inline styles have
 * higher specificity than class selectors).
 */

import type { TokenSet } from "./tokens";

/** Map token keys to CSS variable names */
const TOKEN_TO_VAR: Record<keyof TokenSet, string> = {
  bg: "--bg",
  surface1: "--surface-1",
  surface2: "--surface-2",
  surfaceHover: "--surface-hover",
  text1: "--text-1",
  text2: "--text-2",
  muted: "--muted",
  border: "--border",
  ring: "--ring",
  accent: "--accent",
  accentHover: "--accent-hover",
  accentContrast: "--accent-contrast",
  danger: "--danger",
  warning: "--warning",
  success: "--success",
  shadowColor: "--shadow-color",
  fontFamily: "--font-family",
  fontHeading: "--font-heading",
  radius: "--radius",
  radiusSm: "--radius-sm",
  radiusLg: "--radius-lg",
};

export function injectTheme(): void {
  // Only inject overrides from generated tokens (if the file exists).
  // Default values live in theme.css (:root block) and must NOT be
  // set as inline styles — that would prevent .theme-light from working.
  let overrides: Partial<TokenSet> = {};

  try {
    const modules = import.meta.glob("./tokens.generated.json", {
      eager: true,
    });
    const mod = modules["./tokens.generated.json"] as
      | { default: Partial<TokenSet> }
      | undefined;
    if (mod?.default) {
      overrides = mod.default;
    }
  } catch {
    // No generated tokens — nothing to inject
    return;
  }

  if (Object.keys(overrides).length === 0) return;

  const root = document.documentElement;
  for (const [key, varName] of Object.entries(TOKEN_TO_VAR)) {
    const value = overrides[key as keyof TokenSet];
    if (value !== undefined) {
      root.style.setProperty(varName, value);
    }
  }

  console.log(
    "[theme] Injected",
    Object.keys(overrides).length,
    "generated token overrides",
  );
}
