/**
 * ── useRenderHealth ─────────────────────────────────────────────────────
 *
 * Periodically checks that the Cesium render loop is still advancing.
 * If `scene.frameState.frameNumber` hasn't changed after two consecutive
 * checks (≈60s default), the globe is considered stalled and `stalled`
 * flips to true so the UI can show a recovery banner.
 */

import { useState, useEffect, type RefObject } from "react";
import type { Viewer as CesiumViewer } from "cesium";

const CHECK_INTERVAL_MS = 30_000;

export function useRenderHealth(
  viewerRef: RefObject<CesiumViewer | null>,
  enabled: boolean,
) {
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let lastFrame = -1;
    let missCount = 0;

    const id = setInterval(() => {
      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed()) return;

      const scene = viewer.scene as unknown as Record<string, unknown>;
      const fs = scene.frameState as { frameNumber?: number } | undefined;
      const currentFrame = fs?.frameNumber ?? -1;

      if (currentFrame === lastFrame) {
        missCount++;
        if (missCount >= 2) setStalled(true);
      } else {
        missCount = 0;
        if (stalled) setStalled(false);
      }

      lastFrame = currentFrame;
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(id);
  }, [viewerRef, enabled, stalled]);

  const recover = () => {
    window.location.reload();
  };

  return { stalled, recover };
}
