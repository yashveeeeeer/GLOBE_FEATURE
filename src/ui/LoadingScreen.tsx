/**
 * White full-screen splash that plays the brand animation while the app
 * boots.  Fades out as soon as `ready` is true — no artificial delay.
 */

import { useState, useEffect, useRef, useCallback } from "react";

interface LoadingScreenProps {
  ready: boolean;
}

const FADE_MS = 600;

export function LoadingScreen({ ready }: LoadingScreenProps) {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!ready || fading) return;
    setFading(true);
    const id = setTimeout(() => setVisible(false), FADE_MS);
    return () => clearTimeout(id);
  }, [ready, fading]);

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
        src={`${import.meta.env.BASE_URL}assets/loading.mp4`}
        muted
        autoPlay
        playsInline
        loop
        onCanPlay={handleCanPlay}
      />
    </div>
  );
}
