export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) { super(code); this.status = status; this.code = code; }
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_BODY_BYTES = MAX_IMAGE_BYTES + 32 * 1024;

// Require a JPEG container with a bounded frame before invoking the full decoder.
// This is a preflight, not a replacement for successful server-side decode/re-encode.
export function jpegDimensions(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new ApiError(415, 'invalid_image');
  let p = 2;
  while (p + 3 < bytes.length) {
    if (bytes[p++] !== 0xff) break;
    while (bytes[p] === 0xff) p++;
    const marker = bytes[p++];
    if (marker === 0xda || marker === 0xd9) break;
    const len = (bytes[p] << 8) | bytes[p + 1];
    if (len < 2 || p + len > bytes.length) break;
    if (marker === 0xc0 || marker === 0xc2) {
      if (len < 8) break;
      const height = (bytes[p + 3] << 8) | bytes[p + 4];
      const width = (bytes[p + 5] << 8) | bytes[p + 6];
      if (!width || !height || width > 8192 || height > 8192 || width * height > 16_777_216) throw new ApiError(422, 'image_dimensions');
      return {width, height};
    }
    p += len;
  }
  throw new ApiError(415, 'invalid_image');
}

// Defence in depth after re-encoding: remove every APPn and COM segment, including
// EXIF/GPS, XMP, IPTC and ICC data. Retain only codec data, ending at the JPEG EOI.
export function stripJpegMetadata(b: Uint8Array): Uint8Array {
  jpegDimensions(b);
  const parts: Uint8Array[] = [b.slice(0, 2)];
  let p = 2, entropy = false;
  while (p < b.length) {
    if (entropy) {
      const start = p;
      while (p < b.length) {
        if (b[p] !== 0xff) { p++; continue; }
        const next = b[p + 1];
        if (next === 0 || (next >= 0xd0 && next <= 0xd7)) { p += 2; continue; }
        if (next === 0xff) { p++; continue; }
        break;
      }
      parts.push(b.slice(start, p));
      entropy = false;
    }
    if (b[p] !== 0xff || p + 1 >= b.length) throw new ApiError(422, 'image_processing');
    const start = p++;
    while (b[p] === 0xff) p++;
    const marker = b[p++];
    if (marker === 0xd9) {
      parts.push(new Uint8Array([0xff, 0xd9]));
      const size = parts.reduce((sum, part) => sum + part.length, 0);
      const out = new Uint8Array(size);
      let pos = 0;
      for (const part of parts) { out.set(part, pos); pos += part.length; }
      return out;
    }
    if (marker === 0xd8 || marker === 0 || (marker >= 0xd0 && marker <= 0xd7)) throw new ApiError(422, 'image_processing');
    const len = (b[p] << 8) | b[p + 1];
    if (len < 2 || p + len > b.length) throw new ApiError(422, 'image_processing');
    if (!(marker >= 0xe0 && marker <= 0xef) && marker !== 0xfe) parts.push(b.slice(start, p + len));
    p += len;
    entropy = marker === 0xda;
  }
  throw new ApiError(422, 'image_processing');
}

export async function boundedBody(body: ReadableStream<Uint8Array> | null, max = MAX_BODY_BYTES) {
  if (!body) throw new ApiError(400, 'invalid_request');
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      total += value.length;
      if (total > max) { await reader.cancel(); throw new ApiError(413, 'image_too_large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let pos = 0;
  for (const chunk of chunks) { bytes.set(chunk, pos); pos += chunk.length; }
  return bytes;
}
