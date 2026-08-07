"use client";

import { useEffect, useRef, useState } from "react";

const wechatVideoAttributes = {
  "webkit-playsinline": "true",
  "x5-playsinline": "true",
  "x5-video-player-type": "h5-page",
  "x5-video-orientation": "portrait",
} as const;

export default function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute("muted", "");

    let attempts = 0;
    const tryPlay = () => {
      if (!video.paused || attempts >= 20) return;
      attempts += 1;
      void video.play().catch(() => undefined);
    };
    const resumeWhenVisible = () => {
      if (!document.hidden) tryPlay();
    };

    tryPlay();
    const retryTimer = window.setInterval(tryPlay, 500);
    window.addEventListener("pageshow", tryPlay);
    document.addEventListener("visibilitychange", resumeWhenVisible);
    document.addEventListener("WeixinJSBridgeReady", tryPlay);
    video.addEventListener("canplay", tryPlay);

    return () => {
      window.clearInterval(retryTimer);
      window.removeEventListener("pageshow", tryPlay);
      document.removeEventListener("visibilitychange", resumeWhenVisible);
      document.removeEventListener("WeixinJSBridgeReady", tryPlay);
      video.removeEventListener("canplay", tryPlay);
    };
  }, []);

  return (
    <div className={`hero-media${playing ? " is-playing" : ""}`} aria-hidden="true">
      <div className="hero-video-fallback" />
      <video
        ref={videoRef}
        className="hero-video"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster="/images/wedding-photo-wall-hero-optimized.webp"
        tabIndex={-1}
        disablePictureInPicture
        onPlaying={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        {...wechatVideoAttributes}
      >
        <source src="/videos/wedding-hero-mobile-h264-v13.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
