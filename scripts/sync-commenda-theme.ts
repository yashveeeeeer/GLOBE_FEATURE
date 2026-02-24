/**
 * sync-commenda-theme.ts
 *
 * Extracts design tokens from https://www.commenda.io/ using Playwright
 * and writes them to src/theme/tokens.generated.json.
 *
 * Usage:  npm run theme:sync
 * Requires: playwright (dev dependency)
 */

import { chromium } from "playwright";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(__dirname, "..", "src", "theme", "tokens.generated.json");

interface ExtractedTokens {
  bg?: string;
  text1?: string;
  accent?: string;
  accentContrast?: string;
  border?: string;
  fontFamily?: string;
  fontHeading?: string;
}

async function main() {
  console.log("=== Commenda Theme Sync ===\n");
  console.log("Launching browser...");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log("Navigating to https://www.commenda.io/ ...");
    await page.goto("https://www.commenda.io/", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    // Wait a moment for JS-rendered content
    await page.waitForTimeout(3000);

    console.log("Extracting computed styles...\n");

    const tokens = await page.evaluate(() => {
      const result: Record<string, string | undefined> = {};
      const cs = getComputedStyle;

      // ── Background ──────────────────────────────────────────────
      try {
        const bodyBg = cs(document.body).backgroundColor;
        if (bodyBg && bodyBg !== "rgba(0, 0, 0, 0)") {
          result.bg = bodyBg;
        } else {
          // Try html element
          const htmlBg = cs(document.documentElement).backgroundColor;
          if (htmlBg && htmlBg !== "rgba(0, 0, 0, 0)") result.bg = htmlBg;
        }
      } catch { /* skip */ }

      // ── Text color ──────────────────────────────────────────────
      try {
        result.text1 = cs(document.body).color;
      } catch { /* skip */ }

      // ── CTA button (accent) ─────────────────────────────────────
      const ctaSelectors = [
        'a[href*="book-a-demo"]',
        'a[href*="book"]',
        'button:not([disabled])',
        '.btn-primary',
        '.cta',
      ];
      for (const sel of ctaSelectors) {
        try {
          const el = document.querySelector(sel);
          if (el) {
            const s = cs(el);
            const bg = s.backgroundColor;
            if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
              result.accent = bg;
              result.accentContrast = s.color;
              break;
            }
          }
        } catch { /* skip */ }
      }

      // ── Link color ──────────────────────────────────────────────
      try {
        const link = document.querySelector("a:not([href*='book'])");
        if (link) {
          const c = cs(link).color;
          if (c && !result.accent) result.accent = c;
        }
      } catch { /* skip */ }

      // ── Border color ────────────────────────────────────────────
      const borderSelectors = ["section", "div.card", "[class*='border']", "hr", "header"];
      for (const sel of borderSelectors) {
        try {
          const el = document.querySelector(sel);
          if (el) {
            const bc = cs(el).borderColor || cs(el).borderBottomColor;
            if (bc && bc !== "rgb(0, 0, 0)" && bc !== "rgba(0, 0, 0, 0)") {
              result.border = bc;
              break;
            }
          }
        } catch { /* skip */ }
      }

      // ── Fonts ───────────────────────────────────────────────────
      try {
        result.fontFamily = cs(document.body).fontFamily;
      } catch { /* skip */ }
      try {
        const h1 = document.querySelector("h1");
        if (h1) result.fontHeading = cs(h1).fontFamily;
      } catch { /* skip */ }

      return result;
    });

    // ── Convert rgb() strings to hex ────────────────────────────────
    function rgbToHex(rgb: string | undefined): string | undefined {
      if (!rgb) return undefined;
      const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!match) return rgb; // already hex or other format
      const r = parseInt(match[1]!);
      const g = parseInt(match[2]!);
      const b = parseInt(match[3]!);
      return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
    }

    // Build output, only including successfully extracted values
    const output: ExtractedTokens = {};
    const log: string[] = [];

    if (tokens.bg) {
      output.bg = rgbToHex(tokens.bg);
      log.push(`  bg: ${tokens.bg} → ${output.bg}`);
    }
    if (tokens.text1) {
      output.text1 = rgbToHex(tokens.text1);
      log.push(`  text1: ${tokens.text1} → ${output.text1}`);
    }
    if (tokens.accent) {
      output.accent = rgbToHex(tokens.accent);
      log.push(`  accent: ${tokens.accent} → ${output.accent}`);
    }
    if (tokens.accentContrast) {
      output.accentContrast = rgbToHex(tokens.accentContrast);
      log.push(`  accentContrast: ${tokens.accentContrast} → ${output.accentContrast}`);
    }
    if (tokens.border) {
      output.border = rgbToHex(tokens.border);
      log.push(`  border: ${tokens.border} → ${output.border}`);
    }
    if (tokens.fontFamily) {
      output.fontFamily = tokens.fontFamily;
      log.push(`  fontFamily: ${tokens.fontFamily}`);
    }
    if (tokens.fontHeading) {
      output.fontHeading = tokens.fontHeading;
      log.push(`  fontHeading: ${tokens.fontHeading}`);
    }

    console.log("Extracted values:");
    if (log.length === 0) {
      console.log("  (none — all values will use defaults)");
    } else {
      log.forEach((l) => console.log(l));
    }

    // Write output
    writeFileSync(OUTPUT, JSON.stringify(output, null, 2), "utf-8");
    console.log(`\nWritten to: ${OUTPUT}`);
    console.log(`  ${Object.keys(output).length} tokens extracted`);
    console.log("\n✅ Theme sync complete!");
  } catch (err) {
    console.error("Theme sync failed:", err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
