/**
 * ── Token Resolver ─────────────────────────────────────────────────────
 *
 * Merges generated tokens (from `npm run theme:sync`) over the defaults.
 * If no generated file exists, returns defaults unchanged.
 * Never crashes — missing/invalid generated tokens are silently ignored.
 */

import { defaultTokens, type TokenSet } from "./tokens";

let _resolved: TokenSet | null = null;

export function resolveTokens(): TokenSet {
  if (_resolved) return _resolved;

  let overrides: Partial<TokenSet> = {};

  try {
    // Vite handles JSON imports statically. We use a glob import pattern
    // so missing file doesn't break the build.
    const modules = import.meta.glob("./tokens.generated.json", {
      eager: true,
    });
    const mod = modules["./tokens.generated.json"] as
      | { default: Partial<TokenSet> }
      | undefined;
    if (mod?.default) {
      overrides = mod.default;
      console.log("[theme] Loaded generated tokens:", Object.keys(overrides).length, "overrides");
    }
  } catch {
    // No generated tokens — use defaults
  }

  _resolved = { ...defaultTokens, ...overrides };
  return _resolved;
}
