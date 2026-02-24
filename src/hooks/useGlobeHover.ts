/**
 * ── useGlobeHover ───────────────────────────────────────────────────────
 *
 * Tracks the entity under the cursor on the Cesium globe.
 * Uses ScreenSpaceEventHandler for MOUSE_MOVE to detect hovered entities.
 * Returns the hovered entity ID and screen position for tooltip placement.
 */

import { useEffect, useState, useRef, type RefObject } from "react";
import {
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  defined,
  type Viewer as CesiumViewer,
  type Cartesian2,
} from "cesium";

export interface HoverInfo {
  entityId: string;
  screenX: number;
  screenY: number;
}

export function useGlobeHover(
  viewerRef: RefObject<CesiumViewer | null>,
) {
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const handlerRef = useRef<ScreenSpaceEventHandler | null>(null);

  useEffect(() => {
    const check = () => {
      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed() || !viewer.canvas) return false;
      return true;
    };

    if (!check()) {
      const interval = setInterval(() => {
        if (check()) {
          clearInterval(interval);
          attach();
        }
      }, 500);
      return () => clearInterval(interval);
    }

    attach();

    function attach() {
      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed()) return;

      if (handlerRef.current) {
        handlerRef.current.destroy();
      }

      const handler = new ScreenSpaceEventHandler(viewer.canvas);
      handlerRef.current = handler;

      handler.setInputAction((movement: { endPosition: Cartesian2 }) => {
        if (!viewer || viewer.isDestroyed()) return;

        const picked = viewer.scene.pick(movement.endPosition);
        if (defined(picked) && picked.id?.id) {
          setHover({
            entityId: picked.id.id,
            screenX: movement.endPosition.x,
            screenY: movement.endPosition.y,
          });
        } else {
          setHover(null);
        }
      }, ScreenSpaceEventType.MOUSE_MOVE);
    }

    return () => {
      if (handlerRef.current) {
        handlerRef.current.destroy();
        handlerRef.current = null;
      }
    };
  }, [viewerRef]);

  return hover;
}
