/**
 * ── Default Commenda Design Tokens ─────────────────────────────────────
 *
 * Source of truth for the design system. Based on commenda.io's visual
 * language: dark navy backgrounds, clean Inter typography, blue accent.
 *
 * These values are overridden at runtime if tokens.generated.json exists
 * (produced by `npm run theme:sync`).
 */

export interface TokenSet {
  // Backgrounds
  bg: string;
  surface1: string;
  surface2: string;
  surfaceHover: string;

  // Text
  text1: string;
  text2: string;
  muted: string;

  // Borders & rings
  border: string;
  ring: string;

  // Accent
  accent: string;
  accentHover: string;
  accentContrast: string;

  // Semantic
  danger: string;
  warning: string;
  success: string;

  // Shadow (HSL components for composable opacity)
  shadowColor: string;

  // Typography
  fontFamily: string;
  fontHeading: string;
  fontMono: string;

  // Radii
  radius: string;
  radiusSm: string;
  radiusLg: string;
}

export const defaultTokens: TokenSet = {
  bg: "#07090F",
  surface1: "#0D1117",
  surface2: "#161B22",
  surfaceHover: "#1C2333",

  text1: "#E6EDF3",
  text2: "#8B949E",
  muted: "#484F58",

  border: "#21262D",
  ring: "#58A6FF",

  accent: "#58A6FF",
  accentHover: "#79C0FF",
  accentContrast: "#FFFFFF",

  danger: "#F85149",
  warning: "#F0883E",
  success: "#3FB950",

  shadowColor: "220 40% 2%",

  fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
  fontHeading: "'Inter', 'Segoe UI', system-ui, sans-serif",
  fontMono: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace",

  radius: "4px",
  radiusSm: "2px",
  radiusLg: "6px",
};
