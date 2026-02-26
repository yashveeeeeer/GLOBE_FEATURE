/**
 * ── Theme Injector ─────────────────────────────────────────────────────
 *
 * Called once at app boot. Injects any generated token overrides as CSS
 * custom properties. Default values live in theme.css (:root) and must
 * NOT be set inline or the light/dark toggle would break.
 *
 * Uses resolveTokens() as the single source for generated overrides,
 * avoiding a second independent read of tokens.generated.json.
 */

import { defaultTokens, type TokenSet } from "./tokens";
import { resolveTokens } from "./resolveTokens";

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
  fontMono: "--font-mono",
  radius: "--radius",
  radiusSm: "--radius-sm",
  radiusLg: "--radius-lg",
};

export function injectTheme(): void {
  const resolved = resolveTokens();
  const root = document.documentElement;

  for (const [key, varName] of Object.entries(TOKEN_TO_VAR)) {
    const k = key as keyof TokenSet;
    if (resolved[k] !== defaultTokens[k]) {
      root.style.setProperty(varName, resolved[k]);
    }
  }
}
