// Live camera access for the Share flow. Video only: the microphone is never requested.

export type CameraErrorKind = "unsupported" | "denied" | "unavailable" | "busy" | "failed";

export class CameraError extends Error {
  constructor(readonly kind: CameraErrorKind) {
    super(`Camera ${kind}`);
    this.name = "CameraError";
  }
}

// getUserMedia only exists in secure contexts (HTTPS or localhost).
export function canUseCamera() {
  return typeof window !== "undefined" && window.isSecureContext && typeof navigator.mediaDevices?.getUserMedia === "function";
}

// Rear camera preferred; "ideal" never fails on its own, it just falls back to another camera.
const REAR_CAMERA: MediaStreamConstraints = {
  audio: false,
  video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
};
const ANY_CAMERA: MediaStreamConstraints = { audio: false, video: true };

const errorName = (error: unknown) => (typeof error === "object" && error && "name" in error ? String(error.name) : "");

function toCameraError(error: unknown) {
  switch (errorName(error)) {
    case "NotAllowedError": case "PermissionDeniedError": case "SecurityError": return new CameraError("denied");
    case "NotFoundError": case "DevicesNotFoundError": case "OverconstrainedError": return new CameraError("unavailable");
    case "NotReadableError": case "TrackStartError": case "AbortError": return new CameraError("busy");
    case "TypeError": return new CameraError("unsupported");
    default: return new CameraError("failed");
  }
}

export async function openCamera(): Promise<MediaStream> {
  if (!canUseCamera()) throw new CameraError("unsupported");
  try {
    return await navigator.mediaDevices.getUserMedia(REAR_CAMERA);
  } catch (error) {
    // Retry without constraints only when they (or the requested resolution) were the problem,
    // so a refusal is never followed by a second prompt.
    if (!["OverconstrainedError", "NotFoundError", "NotReadableError"].includes(errorName(error))) throw toCameraError(error);
  }
  try {
    return await navigator.mediaDevices.getUserMedia(ANY_CAMERA);
  } catch (error) {
    throw toCameraError(error);
  }
}

export function stopCamera(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

// Tapping a Share link marks that the visitor asked for the camera, so /live/share can open it
// straight away. A direct visit to /live/share (or a reload) never requests the camera on its own.
const CAMERA_REQUEST_KEY = "aponte-live-open-camera";

export function requestCameraOnArrival() {
  try { window.sessionStorage.setItem(CAMERA_REQUEST_KEY, String(Date.now())); } catch { /* storage blocked: the Open Camera button remains */ }
}

export function consumeCameraRequest() {
  try {
    const requestedAt = Number(window.sessionStorage.getItem(CAMERA_REQUEST_KEY));
    window.sessionStorage.removeItem(CAMERA_REQUEST_KEY);
    return Date.now() - requestedAt < 10_000;
  } catch {
    return false;
  }
}
