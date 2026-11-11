import type { ShareLocation } from "./location";
import type { CapturedPhoto } from "./photo";

// Enabled only in the isolated staging build. Production's prototype stays intact.
export const STAGING_UPLOADS = process.env.NEXT_PUBLIC_LIVE_UPLOADS === "true";
export const CONSENT_VERSION = "staging-2026-11-11-v3";

export type ShareSubmission = {
  photo: CapturedPhoto;
  description: string;
  publicationConsent: boolean;
  // City and country only: precise coordinates are never part of a submission.
  location: Pick<ShareLocation, "city" | "countryCode" | "country"> | null;
  language: string;
};

export function toUploadFormData(submission: ShareSubmission) {
  const data = new FormData();
  data.append("photo", submission.photo.file, submission.photo.file.name);
  data.append("description", submission.description);
  data.append("publicationConsent", String(submission.publicationConsent));
  data.append("language", submission.language);
  if (submission.location) {
    data.append("city", submission.location.city);
    data.append("countryCode", submission.location.countryCode);
    data.append("country", submission.location.country);
  }
  return data;
}

export async function uploadSubmission(submission: ShareSubmission, id: string, token: string) {
  const data = toUploadFormData(submission);
  data.append("processingConsent", "true");
  data.append("consentVersion", CONSENT_VERSION);
  data.append("turnstileToken", token);
  const response = await fetch("/api/submissions", {
    method: "POST", body: data, credentials: "same-origin",
    headers: {"Idempotency-Key": id}, signal: AbortSignal.timeout(60_000),
  });
  const result = await response.json() as {id?: string; status?: string; error?: string};
  if (!response.ok || result.id !== id || result.status !== "pending") throw new Error(result.error ?? "upload_failed");
  return {id, status: "pending" as const};
}
