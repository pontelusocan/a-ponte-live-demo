"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./ScanExperience.module.css";

// The institutional site's /scan (a-ponte-nextjs, src/components/scan/ScanExperience.tsx
// at commit a881f72), reproduced inside the demo's phone frame. Departures from the
// original are marked "Demo:".

/** Original video used on desktop/tablet and the homepage's Brand Film section. */
const VIDEO_SRC =
  "https://pub-109376722caf4cdda41e0ef8b8922b57.r2.dev/Videoplayback.mp4";

/** Temporary mobile version with French subtitles burned into the video. */
const MOBILE_VIDEO_SRC =
  "https://pub-109376722caf4cdda41e0ef8b8922b57.r2.dev/A%20PONTE%20-%20Documentary%20-%20MOBILE%20-%20FR%20-%20WEB.mp4";

// Demo: Visit Website leaves the prototype for the live institutional site
// (the original pushes to its own homepage, forwarding the query string). The
// query string is deliberately not forwarded, so demo visits never reach
// production attribution.
const COMPANY_URL = "https://pontelusocan.com/";

// Demo: the original also sets <html lang>, locks <body> scroll and listens for
// the 768px breakpoint. The demo's layout is already lang="en" and never
// scrolls, and the phone frame is always a phone, so none of that applies.

export default function ScanExperience() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasNavigatedRef = useRef(false);
  const playAttemptedRef = useRef(false);

  const [isSoundOn, setIsSoundOn] = useState(false);

  // Attempt muted autoplay exactly once. Calling .play() manually (rather
  // than relying on the declarative `autoPlay` attribute the original uses)
  // lets a blocked autoplay be detected and logged — the original has no
  // such handling at all, but a rejected play() promise must never become an
  // unhandled rejection. Failure is silent: no visible overlay, no changed
  // layout, matching the original's design exactly (it has no autoplay
  // failure state at all).
  //
  // No pause()-on-cleanup here deliberately: React Strict Mode's dev-only
  // mount→cleanup→mount double-invoke would call play() once, then pause()
  // during the synthetic cleanup, then skip the second play() (guarded by
  // playAttemptedRef) — leaving the video paused on first real load in dev.
  // On a genuine unmount (navigating away), the <video> element is removed
  // from the DOM anyway, which stops playback without needing an explicit call.
  useEffect(() => {
    const videoEl = videoRef.current;

    if (!videoEl || playAttemptedRef.current) return;

    playAttemptedRef.current = true;

    videoEl.play().catch((error) => {
      console.log("Autoplay was blocked:", error);
    });
  }, []);

  // Single source of truth for isSoundOn: the browser fires `volumechange`
  // whenever `.muted` (or `.volume`) actually changes, whether that's this
  // component's own toggle or a browser-forced revert (e.g. a blocked
  // unmute). Deriving state from the event rather than setting it inline at
  // every call site guarantees the icon can never drift out of sync with
  // what's actually audible.
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const syncSoundState = () => {
      setIsSoundOn(!videoEl.muted);
    };

    videoEl.addEventListener("volumechange", syncSoundState);

    return () => {
      videoEl.removeEventListener("volumechange", syncSoundState);
    };
  }, []);

  function navigateToWebsite() {
    // Guards against a possible future double-invocation (e.g. a second
    // rapid click) firing navigation twice.
    if (hasNavigatedRef.current) return;

    hasNavigatedRef.current = true;

    window.location.assign(COMPANY_URL);
  }

  // Demo: the one addition to the original. Forwards the visitor's query
  // string verbatim to /live, the same way the original forwards it to its
  // homepage, so campaign and QR parameters survive into A PONTE Live.
  function navigateToLive() {
    if (hasNavigatedRef.current) return;

    hasNavigatedRef.current = true;

    router.push(`/live${window.location.search}`);
  }

  // Reads/writes videoEl.muted directly rather than trusting isSoundOn alone
  // — the element is the source of truth, and the `volumechange` listener
  // below keeps React state mirroring it (including reverting the icon if
  // the browser rejects an unmute). Unmuting must call .play() synchronously
  // within this click handler (not after an unrelated await) since it's the
  // user gesture some browsers require to allow audible playback.
  async function handleToggleSound() {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (videoEl.muted) {
      videoEl.volume = 1;
      videoEl.muted = false;

      try {
        await videoEl.play();
      } catch (error) {
        // Matches the original: sound-enable can also be blocked by the
        // browser; revert to muted so the element and the icon both stay
        // truthful rather than showing "sound on" while nothing plays.
        videoEl.muted = true;

        console.log("Playback with sound was blocked:", error);
      }
    } else {
      videoEl.muted = true;
    }
  }

  return (
    // Demo: the experience fills the phone frame on the black demo stage
    // instead of the whole browser window.
    <main className="demo-stage">
      <section
        className={`phone ${styles.shell}`}
        aria-label="A PONTE brand film experience"
      >
        <div
          className={styles.backdrop}
          aria-hidden="true"
        />

        <div className={styles.stage}>
          {/* Demo: wraps the video so the CTA row can sit a fixed distance
              above its top edge, wherever the video ends up. */}
          <div className={styles.videoFrame}>
            {/* Demo: both CTAs together, side by side above the video, in the
                institutional site's button style — the original has a single
                Visit Website pill in the top-right corner. */}
            <div className={styles.ctaRow}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={navigateToLive}
              >
                Discover A PONTE Live
              </button>

              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={navigateToWebsite}
              >
                Visit Website
              </button>
            </div>

            <video
              ref={videoRef}
              className={styles.video}
              // Native controls provide play/pause, a draggable/clickable
              // timeline and volume with each browser's own touch, keyboard and
              // screen-reader support. Their mute button fires `volumechange`
              // just like the custom sound toggle, so isSoundOn stays in sync.
              controls
              muted
              playsInline
              preload="auto"
              aria-label="A PONTE brand film"
            >
              {/* Mobile: French subtitles, 4:5 format.
                  Demo: always chosen, since the frame is always a phone; no
                  media query, which would test the desktop window instead. */}
              <source
                src={MOBILE_VIDEO_SRC}
                type="video/mp4"
              />

              {/* Desktop and tablet: original video. Demo: only reached if
                  the mobile file fails to load. */}
              <source
                src={VIDEO_SRC}
                type="video/mp4"
              />

              Your browser does not support the video tag.
            </video>
          </div>
        </div>

        <button
          type="button"
          className={styles.soundBtn}
          onClick={handleToggleSound}
          aria-label={isSoundOn ? "Sound is on" : "Enable sound"}
          aria-pressed={isSoundOn}
        >
          {isSoundOn ? (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M4 9v6h4l5 5V4L8 9H4z"
                fill="currentColor"
              />
              <path
                d="M16.3 8.3a5.5 5.5 0 0 1 0 7.4"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <path
                d="M19 5.5a9.5 9.5 0 0 1 0 13"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M4 9v6h4l5 5V4L8 9H4z"
                fill="currentColor"
              />
              <path
                d="M16.5 9.5l5 5M21.5 9.5l-5 5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
      </section>
    </main>
  );
}
