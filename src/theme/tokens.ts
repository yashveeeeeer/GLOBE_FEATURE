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

  // Radii
  radius: string;
  radiusSm: string;
  radiusLg: string;
}

export const defaultTokens: TokenSet = {
  // Backgrounds
  bg: "#0B0F1A",
  surface1: "#111827",
  surface2: "#1E2536",
  surfaceHover: "#263044",

  // Text
  text1: "#F1F5F9",
  text2: "#CBD5E1",
  muted: "#64748B",

  // Borders & rings
  border: "#1E293B",
  ring: "#3B82F6",

  // Accent (Commenda blue)
  accent: "#3B82F6",
  accentHover: "#2563EB",
  accentContrast: "#FFFFFF",

  // Semantic
  danger: "#EF4444",
  warning: "#F59E0B",
  success: "#10B981",

  // Shadow
  shadowColor: "220 40% 2%",

  // Typography
  fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
  fontHeading: "'Inter', 'Segoe UI', system-ui, sans-serif",

  // Radii
  radius: "12px",
  radiusSm: "8px",
  radiusLg: "16px",
};
