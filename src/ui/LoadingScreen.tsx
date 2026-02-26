/**
 * White full-screen splash that plays the brand animation for a minimum
 * of 5 seconds.  Dismisses only after both the timer AND all app data
 * have finished loading — so the user never sees any partial UI.
 */

import { useState, useEffect, useRef, useCallback } from "react";

interface LoadingScreenProps {
  ready: boolean;
}

const MIN_DISPLAY_MS = 5000;
const FADE_MS = 600;

export function LoadingScreen({ ready }: LoadingScreenProps) {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const [timerDone, setTimerDone] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setTimerDone(true), MIN_DISPLAY_MS);
    return () => clearTimeout(id);
  }, []);

  const canDismiss = ready && timerDone;

  useEffect(() => {
    if (!canDismiss || fading) return;
    setFading(true);
    const id = setTimeout(() => setVisible(false), FADE_MS);
    return () => clearTimeout(id);
  }, [canDismiss, fading]);

  const handleCanPlay = useCallback(() => {
    videoRef.current?.play().catch(() => {});
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`loading-screen${fading ? " loading-screen--fade" : ""}`}
      style={{ "--fade-ms": `${FADE_MS}ms` } as React.CSSProperties}
    >
      <video
        ref={videoRef}
        className="loading-screen__video"
        src="/assets/loading.mp4"
        muted
        autoPlay
        playsInline
        loop
        onCanPlay={handleCanPlay}
      />
    </div>
  );
}
