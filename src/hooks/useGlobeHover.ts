/**
 * ── useGlobeHover ───────────────────────────────────────────────────────
 *
 * Tracks the entity under the cursor on the Cesium globe.
 * Uses ScreenSpaceEventHandler for MOUSE_MOVE to detect hovered entities.
 * Returns the hovered entity ID and screen position for tooltip placement.
 *
 * Position updates are throttled to ~60 fps to avoid excess re-renders
 * when the cursor moves over the same entity.
 */

import { useEffect, useState, useRef, type RefObject } from "react";
import {
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  ColorMaterialProperty,
  Color,
  defined,
  type Viewer as CesiumViewer,
  type Cartesian2,
  type Entity,
} from "cesium";

export interface HoverInfo {
  entityId: string;
  screenX: number;
  screenY: number;
}

const HOVER_ALPHA_BOOST = 0.18;
const THROTTLE_MS = 16; // ~60 fps

export function useGlobeHover(
  viewerRef: RefObject<CesiumViewer | null>,
) {
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const handlerRef = useRef<ScreenSpaceEventHandler | null>(null);
  const prevEntityRef = useRef<Entity | null>(null);
  const prevMaterialRef = useRef<ColorMaterialProperty | null>(null);
  const rafRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(0);
  const pendingHoverRef = useRef<HoverInfo | null>(null);

  useEffect(() => {
    let aborted = false;

    const check = () => {
      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed() || !viewer.canvas) return false;
      return true;
    };

    if (!check()) {
      const interval = setInterval(() => {
        if (aborted) { clearInterval(interval); return; }
        if (check()) {
          clearInterval(interval);
          attach();
        }
      }, 500);
      return () => { aborted = true; clearInterval(interval); };
    }

    attach();

    function restorePrevious() {
      const prev = prevEntityRef.current;
      if (prev?.polygon && prevMaterialRef.current) {
        prev.polygon.material = prevMaterialRef.current;
      }
      prevEntityRef.current = null;
      prevMaterialRef.current = null;
    }

    function scheduleHoverUpdate(info: HoverInfo | null) {
      const now = performance.now();
      pendingHoverRef.current = info;

      if (now - lastUpdateRef.current >= THROTTLE_MS) {
        lastUpdateRef.current = now;
        setHover(info);
      } else {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          lastUpdateRef.current = performance.now();
          setHover(pendingHoverRef.current);
        });
      }
    }

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
          const entity = picked.id as Entity;

          if (entity !== prevEntityRef.current) {
            restorePrevious();

            if (entity.polygon) {
              const currentMat = entity.polygon.material;
              if (currentMat instanceof ColorMaterialProperty) {
                prevEntityRef.current = entity;
                prevMaterialRef.current = currentMat;
                const currentColor = currentMat.color?.getValue(viewer.clock.currentTime);
                if (currentColor) {
                  const boosted = currentColor.withAlpha(
                    Math.min(1, currentColor.alpha + HOVER_ALPHA_BOOST),
                  );
                  entity.polygon.material = new ColorMaterialProperty(
                    Color.fromAlpha(boosted, boosted.alpha),
                  );
                }
              }
            }
          }

          scheduleHoverUpdate({
            entityId: entity.id,
            screenX: movement.endPosition.x,
            screenY: movement.endPosition.y,
          });
        } else {
          restorePrevious();
          scheduleHoverUpdate(null);
        }
      }, ScreenSpaceEventType.MOUSE_MOVE);
    }

    return () => {
      aborted = true;
      cancelAnimationFrame(rafRef.current);
      restorePrevious();
      if (handlerRef.current) {
        handlerRef.current.destroy();
        handlerRef.current = null;
      }
    };
  }, [viewerRef]);

  return hover;
}
