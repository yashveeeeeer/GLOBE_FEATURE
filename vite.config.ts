import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";

const cesiumSource = "node_modules/cesium/Build/Cesium";
const cesiumBaseUrl = "cesiumStatic";

function normalizeBasePath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "/";
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.endsWith("/")
    ? withLeadingSlash
    : `${withLeadingSlash}/`;
}

function resolveBasePath(): string {
  const fromEnv = process.env.VITE_BASE_PATH;
  if (fromEnv) return normalizeBasePath(fromEnv);

  if (!process.env.GITHUB_ACTIONS) return "/";

  const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];
  if (!repoName || repoName.toLowerCase().endsWith(".github.io")) return "/";

  return `/${repoName}/`;
}

const base = resolveBasePath();

// https://vitejs.dev/config/
export default defineConfig({
  base,
  define: {
    CESIUM_BASE_URL: JSON.stringify(`${base}${cesiumBaseUrl}/`),
  },
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: `${cesiumSource}/ThirdParty`, dest: cesiumBaseUrl },
        { src: `${cesiumSource}/Workers`, dest: cesiumBaseUrl },
        { src: `${cesiumSource}/Assets`, dest: cesiumBaseUrl },
        { src: `${cesiumSource}/Widgets`, dest: cesiumBaseUrl },
      ],
    }),
  ],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          cesium: ["cesium"],
        },
      },
    },
  },
});
