import type { ShareLocation } from "./location";
import type { CapturedPhoto } from "./photo";

// There is no backend yet. The Share flow builds a ShareSubmission and keeps it in memory; nothing
// is uploaded, stored, reviewed or emailed. When an upload endpoint exists, send
// toUploadFormData(submission) to it, then switch this flag on so the confirmation screen
// may say an email is on its way.
export const SUBMISSION_BACKEND_CONNECTED = false;

export type ShareSubmission = {
  photo: CapturedPhoto;
  name: string;
  description: string;
  publicationConsent: true;
  // City and country only: precise coordinates are never part of a submission.
  location: Pick<ShareLocation, "city" | "countryCode" | "country"> | null;
  email: string | null;
  language: string;
};

export function toUploadFormData(submission: ShareSubmission) {
  const data = new FormData();
  data.append("photo", submission.photo.file, submission.photo.file.name);
  data.append("name", submission.name);
  data.append("description", submission.description);
  data.append("publicationConsent", "true");
  data.append("language", submission.language);
  if (submission.location) {
    data.append("city", submission.location.city);
    data.append("countryCode", submission.location.countryCode);
    data.append("country", submission.location.country);
  }
  if (submission.email) data.append("email", submission.email);
  return data;
}
