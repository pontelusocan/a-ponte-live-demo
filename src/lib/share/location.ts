// Optional, permission-based location for a shared moment.
// Coordinates exist only in memory, for the duration of one reverse-geocoding lookup: they are
// never put in React state, the submission, the URL, storage or analytics.

export type Coordinates = { latitude: number; longitude: number };

// What a moment keeps: structured place values matching the gallery's country filters.
export type ShareLocation = {
  city: string;
  // ISO 3166-1 alpha-2, or "" when the country was typed by hand.
  countryCode: string;
  country: string;
  source: "detected" | "manual";
};

export type LocationErrorKind = "unsupported" | "denied" | "timeout" | "unavailable" | "lookupFailed";

export class LocationError extends Error {
  constructor(readonly kind: LocationErrorKind) {
    super(`Location ${kind}`);
    this.name = "LocationError";
  }
}

// Two decimal places is roughly 1 km: enough to find a city, without a street-level position.
const round = (value: number) => Math.round(value * 100) / 100;

export function getApproximatePosition(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation || !window.isSecureContext) {
      reject(new LocationError("unsupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: round(coords.latitude), longitude: round(coords.longitude) }),
      (error) => reject(new LocationError(
        error.code === error.PERMISSION_DENIED ? "denied" : error.code === error.TIMEOUT ? "timeout" : "unavailable",
      )),
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 10 * 60_000 },
    );
  });
}
