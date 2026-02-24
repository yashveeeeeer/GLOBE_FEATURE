/**
 * ── useKeyboardReset ────────────────────────────────────────────────────
 *
 * Spacebar on globe → reset to world view.
 * Also makes the globe container focusable so it can receive key events.
 */

import { useEffect, type RefObject } from "react";
import { useSelectionStore } from "../state/selectionStore";

export function useKeyboardReset(mountRef: RefObject<HTMLDivElement | null>) {
  const resetToWorld = useSelectionStore((s) => s.resetToWorld);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      e.preventDefault();
      resetToWorld();
    };

    el.setAttribute("tabindex", "0");
    el.style.outline = "none";
    el.addEventListener("keydown", onKeyDown);

    const onClick = () => el.focus();
    el.addEventListener("click", onClick);

    return () => {
      el.removeEventListener("keydown", onKeyDown);
      el.removeEventListener("click", onClick);
    };
  }, [resetToWorld, mountRef]);
}
