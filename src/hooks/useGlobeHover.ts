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

export function useGlobeHover(
  viewerRef: RefObject<CesiumViewer | null>,
) {
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const handlerRef = useRef<ScreenSpaceEventHandler | null>(null);
  const prevEntityRef = useRef<Entity | null>(null);
  const prevMaterialRef = useRef<ColorMaterialProperty | null>(null);

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

    function restorePrevious() {
      const prev = prevEntityRef.current;
      if (prev?.polygon && prevMaterialRef.current) {
        prev.polygon.material = prevMaterialRef.current;
      }
      prevEntityRef.current = null;
      prevMaterialRef.current = null;
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

          setHover({
            entityId: entity.id,
            screenX: movement.endPosition.x,
            screenY: movement.endPosition.y,
          });
        } else {
          restorePrevious();
          setHover(null);
        }
      }, ScreenSpaceEventType.MOUSE_MOVE);
    }

    return () => {
      restorePrevious();
      if (handlerRef.current) {
        handlerRef.current.destroy();
        handlerRef.current = null;
      }
    };
  }, [viewerRef]);

  return hover;
}
