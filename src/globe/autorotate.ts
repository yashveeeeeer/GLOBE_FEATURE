/**
 * ── Idle auto-rotation controller ──────────────────────────────────────
 *
 * Slowly spins the globe when the user is at the world level and hasn't
 * interacted with the viewer for a configurable idle timeout.
 *
 * Behaviour:
 *  - Rotation starts when `enable()` is called and no pointer is active.
 *  - Any `pointerdown` / `wheel` event pauses rotation immediately.
 *  - Rotation resumes after `IDLE_TIMEOUT_MS` of no interaction.
 *  - Calling `disable()` stops everything and cleans up listeners.
 */

import { type Viewer, Math as CesiumMath } from "cesium";
import { alive } from "./guards";

/* ── Configuration ───────────────────────────────────────────────────── */

/** Rotation speed in radians per second */
const ROTATE_SPEED = CesiumMath.toRadians(3); // 3°/s

/** Time in ms before auto-rotation resumes after user interaction */
const IDLE_TIMEOUT_MS = 3_000;

/* ── Internal state ──────────────────────────────────────────────────── */

let _enabled = false;
let _rotating = false;
let _idleTimer: ReturnType<typeof setTimeout> | null = null;
let _tickCallback: ((clock: unknown) => void) | null = null;
let _viewer: Viewer | null = null;

let _onPtrDown: (() => void) | null = null;
let _onPtrUp: (() => void) | null = null;
let _onWheel: (() => void) | null = null;
let _canvas: HTMLCanvasElement | null = null;

function startRotation(): void {
  if (_rotating || !alive(_viewer)) return;
  _rotating = true;

  _tickCallback = () => {
    if (!_rotating || !alive(_viewer)) return;
    _viewer.scene.camera.rotateRight(ROTATE_SPEED / 60);
  };

  _viewer.clock.onTick.addEventListener(_tickCallback);
}

function stopRotation(): void {
  _rotating = false;
  if (_tickCallback && alive(_viewer)) {
    _viewer.clock.onTick.removeEventListener(_tickCallback);
  }
  _tickCallback = null;
}

function scheduleResume(): void {
  clearIdleTimer();
  _idleTimer = setTimeout(() => {
    if (_enabled) startRotation();
  }, IDLE_TIMEOUT_MS);
}

function clearIdleTimer(): void {
  if (_idleTimer !== null) {
    clearTimeout(_idleTimer);
    _idleTimer = null;
  }
}

/* ── Public API ──────────────────────────────────────────────────────── */

/**
 * Enable idle auto-rotation on the given viewer.
 * Safe to call multiple times — will not double-register listeners.
 */
export function enableAutoRotate(viewer: Viewer): void {
  if (_enabled) return;
  if (!alive(viewer)) return;

  _enabled = true;
  _viewer = viewer;
  _canvas = viewer.canvas;

  _onPtrDown = () => {
    stopRotation();
    clearIdleTimer();
  };

  _onPtrUp = () => {
    if (_enabled) scheduleResume();
  };

  _onWheel = () => {
    stopRotation();
    clearIdleTimer();
    if (_enabled) scheduleResume();
  };

  _canvas.addEventListener("pointerdown", _onPtrDown);
  _canvas.addEventListener("pointerup", _onPtrUp);
  _canvas.addEventListener("wheel", _onWheel);

  // Start rotating immediately
  startRotation();
}

/**
 * Disable auto-rotation and remove all listeners.
 */
export function disableAutoRotate(): void {
  _enabled = false;
  stopRotation();
  clearIdleTimer();

  if (_canvas) {
    if (_onPtrDown) _canvas.removeEventListener("pointerdown", _onPtrDown);
    if (_onPtrUp) _canvas.removeEventListener("pointerup", _onPtrUp);
    if (_onWheel) _canvas.removeEventListener("wheel", _onWheel);
  }

  _onPtrDown = null;
  _onPtrUp = null;
  _onWheel = null;
  _canvas = null;
  _viewer = null;
}

