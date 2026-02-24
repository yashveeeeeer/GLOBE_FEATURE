import { createRoot } from "react-dom/client";
import { injectTheme } from "./theme/injectTokens";
import "./theme/theme.css";
import App from "./App";

// Inject theme tokens as CSS variables before first render
injectTheme();

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

// NOTE: StrictMode is intentionally omitted.
// CesiumJS creates an imperative WebGL context that cannot survive
// the mount → unmount → re-mount cycle StrictMode triggers in dev.
createRoot(root).render(<App />);
