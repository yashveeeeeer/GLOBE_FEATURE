import type { Viewer } from "cesium";

export function alive(v: Viewer | null): v is Viewer {
  return !!v && !v.isDestroyed();
}
