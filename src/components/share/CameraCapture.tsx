"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import type { Text } from "@/components/Experience";
import { CameraError, type CameraErrorKind, openCamera, stopCamera } from "@/lib/share/camera";
import { type CapturedPhoto, captureVideoFrame, useObjectUrl } from "@/lib/share/photo";

type Status = "starting" | "live" | "capturing" | "captured";

// Full-screen live preview over the phone screen. The camera runs only while this is mounted and
// no photo is waiting for confirmation: capturing, closing, unmounting or hiding the page stops
// every track.
export default function CameraCapture({ text, intro, onIntroDone, onChoose, onCapture, onCancel, onError }: {
  text: Text;
  intro?: {cameraTitle: string; cameraBody: string; take: string; choose: string};
  onIntroDone: () => void;
  onChoose: () => void;
  onCapture: (photo: CapturedPhoto) => void;
  onCancel: () => void;
  onError: (kind: CameraErrorKind) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const onErrorRef = useRef(onError);
  const [status, setStatus] = useState<Status>("starting");
  const [mirrored, setMirrored] = useState(false);
  const [captured, setCaptured] = useState<CapturedPhoto | null>(null);
  const [captureFailed, setCaptureFailed] = useState(false);
  // Bumped to (re)start the camera: retake, or returning to the page after it was hidden.
  const [session, setSession] = useState(0);
  const capturedUrl = useObjectUrl(captured?.file ?? null);

  useEffect(() => { onErrorRef.current = onError; });
  useEffect(() => { closeButton.current?.focus({ preventScroll: true }); }, []);

  function release() {
    stopCamera(stream.current);
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  }

  useEffect(() => {
    if (captured) return;
    let cancelled = false;
    setStatus("starting");
    openCamera().then((opened) => {
      if (cancelled) { stopCamera(opened); return; }
      stream.current = opened;
      const track = opened.getVideoTracks()[0];
      setMirrored(track?.getSettings().facingMode === "user");
      // Fires if the camera disappears (unplugged, taken by another app); stop() never fires it.
      track?.addEventListener("ended", () => { if (!cancelled) onErrorRef.current("unavailable"); });
      if (video.current) {
        video.current.srcObject = opened;
        video.current.play().catch(() => { /* autoplay of a muted inline video is allowed; "playing" still arrives */ });
      }
    }, (error: unknown) => {
      if (!cancelled) onErrorRef.current(error instanceof CameraError ? error.kind : "failed");
    });
    return () => { cancelled = true; release(); };
  }, [captured, session]);

  // A hidden page must not keep the camera open; it restarts when the visitor comes back.
  // Only a running camera is paused: some phones hide the page while their native permission
  // dialog is open, and restarting then would send a second camera request behind it.
  useEffect(() => {
    if (captured) return;
    let paused = false;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (!stream.current) return;
        release();
        paused = true;
        setStatus("starting");
      } else if (paused) {
        paused = false;
        setSession((n) => n + 1);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [captured]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  async function takePhoto() {
    const frame = video.current;
    if (status !== "live" || !frame?.videoWidth) return;
    setStatus("capturing");
    setCaptureFailed(false);
    // captureVideoFrame draws the frame synchronously, so the camera can stop before encoding.
    const pending = captureVideoFrame(frame);
    release();
    try {
      setCaptured(await pending);
      setStatus("captured");
    } catch {
      setCaptureFailed(true);
      setSession((n) => n + 1);
    }
  }

  function retake() {
    setCaptured(null);
    setCaptureFailed(false);
  }

  return <div className="camera-view" role="dialog" aria-modal="true" aria-label={text.cameraLabel}>
    <video ref={video} className={`camera-video ${intro ? "camera-video-blurred" : ""} ${mirrored ? "is-mirrored" : ""}`} hidden={!!captured} autoPlay playsInline muted onPlaying={() => setStatus((s) => (s === "starting" ? "live" : s))}/>
    {captured && capturedUrl && <img className="camera-still" src={capturedUrl} alt={text.capturedAlt}/>}
    {status === "starting" && <p className="camera-status" role="status">{text.cameraStarting}</p>}
    <button ref={closeButton} type="button" className="capture-close" onClick={onCancel} aria-label={text.closeCamera}><Icon name="x" size={20}/></button>
    {captureFailed && <p className="camera-error" role="alert">{text.captureFailed}</p>}
    {intro ? <section className="capture-screen camera-intro"><div className="capture-form capture-centered">
      <h1>{intro.cameraTitle}</h1>
      <p className="capture-lede">{intro.cameraBody}</p>
      <button type="button" className="btn btn-white capture-submit" onClick={onIntroDone}>{intro.take}</button>
      <button type="button" className="capture-skip" onClick={onChoose}>{intro.choose}</button>
    </div></section> : <div className="camera-controls">
      {captured
        ? <>
          <button type="button" className="btn btn-outline" onClick={retake}>{text.retake}</button>
          <button type="button" className="btn btn-white" onClick={() => onCapture(captured)}>{text.usePhoto}</button>
        </>
        : <button type="button" className="camera-shutter" onClick={takePhoto} disabled={status !== "live"} aria-label={text.capturePhoto}/>}
    </div>}
  </div>;
}
