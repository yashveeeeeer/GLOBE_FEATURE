/**
 * Full-screen splash that plays the brand animation video while the app
 * boots in the background. Stays visible for at least MIN_DISPLAY_MS so
 * the animation completes, then crossfades out once data is ready.
 */

import { useState, useEffect, useRef, useCallback } from "react";

interface LoadingScreenProps {
  ready: boolean;
}

const FADE_MS = 800;
const MIN_DISPLAY_MS = 5000;

export function LoadingScreen({ ready }: LoadingScreenProps) {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mountTime = useRef(Date.now());

  useEffect(() => {
    const remaining = MIN_DISPLAY_MS - (Date.now() - mountTime.current);
    const id = setTimeout(() => setMinElapsed(true), Math.max(0, remaining));
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!ready || !minElapsed || fading) return;
    setFading(true);
    const id = setTimeout(() => setVisible(false), FADE_MS);
    return () => clearTimeout(id);
  }, [ready, minElapsed, fading]);

  const handleCanPlay = useCallback(() => {
    videoRef.current?.play().catch(() => {});
  }, []);

  const handleVideoError = useCallback(() => {
    setMinElapsed(true);
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`boot-screen${fading ? " boot-screen--fade" : ""}`}
      style={{ "--fade-ms": `${FADE_MS}ms` } as React.CSSProperties}
    >
      <div className="boot-screen__content">
        <video
          ref={videoRef}
          className="boot-screen__video"
          src={`${import.meta.env.BASE_URL}assets/loading.mp4`}
          muted
          autoPlay
          playsInline
          loop
          onCanPlay={handleCanPlay}
          onError={handleVideoError}
        />
      </div>
    </div>
  );
}
