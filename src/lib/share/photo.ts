import { useEffect, useState } from "react";

// Every photo, from the live camera or the phone's own picker, is re-encoded to a JPEG of at most
// MAX_EDGE pixels. That keeps future uploads small and drops the original file's metadata,
// including any GPS coordinates a library photo carries in its EXIF data.
const MAX_EDGE = 2048;
const JPEG_QUALITY = 0.88;

export type CapturedPhoto = {
  file: File;
  width: number;
  height: number;
  source: "camera" | "picker";
};

async function toJpeg(image: CanvasImageSource, width: number, height: number, source: CapturedPhoto["source"]): Promise<CapturedPhoto> {
  if (!width || !height) throw new Error("Image has no size");
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  // Drawn synchronously, before the first await: callers may stop the camera right after calling.
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
  if (!blob) throw new Error("JPEG encoding failed");
  const now = Date.now();
  const file = new File([blob], `a-ponte-moment-${now}.jpg`, { type: "image/jpeg", lastModified: now });
  return { file, width: canvas.width, height: canvas.height, source };
}

export function captureVideoFrame(video: HTMLVideoElement) {
  return toJpeg(video, video.videoWidth, video.videoHeight, "camera");
}

// Browsers apply the EXIF orientation when drawing a decoded <img>, so portrait photos stay upright.
export async function photoFromFile(file: File) {
  if (file.type && !file.type.startsWith("image/")) throw new Error("Not an image");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return await toJpeg(image, image.naturalWidth, image.naturalHeight, "picker");
  } finally {
    URL.revokeObjectURL(url);
  }
}

// An object URL for showing a Blob, revoked when the Blob changes or the component unmounts.
// The previous URL stays in place until the next one is ready, so images never flash empty.
export function useObjectUrl(blob: Blob | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) { setUrl(null); return; }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}
