/**
 * ── useRenderHealth ─────────────────────────────────────────────────────
 *
 * Periodically checks that the Cesium render loop is still advancing.
 * If `scene.frameState.frameNumber` hasn't changed after two consecutive
 * checks (≈60s default), the globe is considered stalled and `stalled`
 * flips to true so the UI can show a recovery banner.
 */

import { useState, useEffect, useRef, type RefObject } from "react";
import type { Viewer as CesiumViewer } from "cesium";

const CHECK_INTERVAL_MS = 30_000;

export function useRenderHealth(
  viewerRef: RefObject<CesiumViewer | null>,
  enabled: boolean,
) {
  const [stalled, setStalled] = useState(false);
  const stalledRef = useRef(false);
  const renderTickRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const onPostRender = () => {
      renderTickRef.current += 1;
    };
    viewer.scene.postRender.addEventListener(onPostRender);

    let lastTick = renderTickRef.current;
    let missCount = 0;

    const id = setInterval(() => {
      const liveViewer = viewerRef.current;
      if (!liveViewer || liveViewer.isDestroyed()) return;
      if (document.visibilityState !== "visible") return;

      const currentTick = renderTickRef.current;
      if (currentTick === lastTick) {
        missCount++;
        if (missCount >= 2 && !stalledRef.current) {
          stalledRef.current = true;
          setStalled(true);
        }
      } else {
        missCount = 0;
        if (stalledRef.current) {
          stalledRef.current = false;
          setStalled(false);
        }
      }

      lastTick = currentTick;
    }, CHECK_INTERVAL_MS);

    return () => {
      clearInterval(id);
      viewer.scene.postRender.removeEventListener(onPostRender);
    };
  }, [viewerRef, enabled]);

  const recover = () => {
    window.location.reload();
  };

  return { stalled, recover };
}
