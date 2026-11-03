import { LocationError, type Coordinates } from "./location";

// Reverse geocoding turns approximate coordinates into a city and country. The provider is a
// third party: the Share flow names it (ReverseGeocoder.name) and asks before calling lookup().
// To change provider, implement ReverseGeocoder and point reverseGeocoder at it.

export type ReverseGeocodeResult = {
  city: string;
  // ISO 3166-1 alpha-2, upper case, or "" when the provider could not tell.
  countryCode: string;
  // In the requested language when the provider supports it.
  country: string;
};

export type ReverseGeocoder = {
  name: string;
  lookup(coordinates: Coordinates, language: string, signal?: AbortSignal): Promise<ReverseGeocodeResult>;
};

const LOOKUP_TIMEOUT_MS = 10_000;

// BigDataCloud's free client-side endpoint: no key, intended to be called from the visitor's own
// browser with that device's current position (https://www.bigdatacloud.com/free-api/free-reverse-geocode-to-city-api).
// Review its fair-use terms and privacy policy before going beyond the pilot.
const bigDataCloud: ReverseGeocoder = {
  name: "BigDataCloud",
  async lookup({ latitude, longitude }, language, signal) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort);
    const timer = window.setTimeout(abort, LOOKUP_TIMEOUT_MS);
    try {
      const params = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), localityLanguage: language });
      const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`, { signal: controller.signal, credentials: "omit" });
      if (!response.ok) throw new LocationError("lookupFailed");
      const data: { city?: string; locality?: string; countryCode?: string; countryName?: string } = await response.json();
      const result = {
        city: (data.city || data.locality || "").trim(),
        countryCode: (data.countryCode || "").trim().toUpperCase(),
        country: (data.countryName || "").trim(),
      };
      if (!result.city && !result.countryCode) throw new LocationError("lookupFailed");
      return result;
    } catch (error) {
      throw error instanceof LocationError ? error : new LocationError("lookupFailed");
    } finally {
      window.clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  },
};

export const reverseGeocoder: ReverseGeocoder = bigDataCloud;
