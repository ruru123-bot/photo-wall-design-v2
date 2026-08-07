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
    let retryTimer: number | undefined;
    const scheduleRetry = () => {
      if (retryTimer !== undefined || attempts >= 8) return;
      retryTimer = window.setTimeout(() => {
        retryTimer = undefined;
        tryPlay();
      }, 700);
    };
    const tryPlay = () => {
      if (!video.paused || attempts >= 8) return;
      attempts += 1;
      void video.play().catch(scheduleRetry);
    };
    const resumeWhenVisible = () => {
      if (!document.hidden) tryPlay();
    };
    const stopRetrying = () => {
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      retryTimer = undefined;
    };

    tryPlay();
    window.addEventListener("pageshow", tryPlay);
    document.addEventListener("visibilitychange", resumeWhenVisible);
    document.addEventListener("WeixinJSBridgeReady", tryPlay);
    video.addEventListener("canplay", tryPlay);
    video.addEventListener("playing", stopRetrying);

    return () => {
      stopRetrying();
      window.removeEventListener("pageshow", tryPlay);
      document.removeEventListener("visibilitychange", resumeWhenVisible);
      document.removeEventListener("WeixinJSBridgeReady", tryPlay);
      video.removeEventListener("canplay", tryPlay);
      video.removeEventListener("playing", stopRetrying);
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
