"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import type { Text } from "@/components/Experience";
import { getApproximatePosition, LocationError, type LocationErrorKind, type ShareLocation } from "@/lib/share/location";
import { reverseGeocoder } from "@/lib/share/reverse-geocode";

type Status = "idle" | "locating" | "found" | LocationErrorKind;

// Optional step after the photo: detect the city and country (browser permission, then the
// disclosed third-party lookup), or type them, or skip. Either way the visitor can continue.
export default function LocationStep({ text, language, markets, initial, onDone }: {
  text: Text;
  // Lower-case language code for the geocoder's place names.
  language: string;
  // The gallery's country filters, labelled in the current language.
  markets: { code: string; label: string }[];
  initial: ShareLocation | null;
  onDone: (location: ShareLocation | null) => void;
}) {
  const isMarket = (code: string) => markets.some((m) => m.code === code);
  const [status, setStatus] = useState<Status>("idle");
  const [city, setCity] = useState(initial?.city ?? "");
  // A market code, "other", or "" for no country.
  const [countryChoice, setCountryChoice] = useState(initial ? (isMarket(initial.countryCode) ? initial.countryCode : initial.country ? "other" : "") : "");
  const [otherCountry, setOtherCountry] = useState(initial && !isMarket(initial.countryCode) ? initial.country : "");
  // The ISO code behind a detected non-market country, kept until the visitor edits that country.
  const [otherCode, setOtherCode] = useState(initial && !isMarket(initial.countryCode) ? initial.countryCode : "");
  const [source, setSource] = useState<ShareLocation["source"]>(initial?.source ?? "manual");
  const lookup = useRef<AbortController | null>(null);

  useEffect(() => () => lookup.current?.abort(), []);

  async function detect() {
    lookup.current?.abort();
    const controller = new AbortController();
    lookup.current = controller;
    setStatus("locating");
    try {
      const coordinates = await getApproximatePosition();
      if (controller.signal.aborted) return;
      // The coordinates go no further than this lookup: only the city and country are kept.
      const place = await reverseGeocoder.lookup(coordinates, language, controller.signal);
      if (controller.signal.aborted) return;
      setCity(place.city);
      if (isMarket(place.countryCode)) { setCountryChoice(place.countryCode); setOtherCountry(""); setOtherCode(""); }
      else if (place.countryCode || place.country) { setCountryChoice("other"); setOtherCountry(place.country || place.countryCode); setOtherCode(place.countryCode); }
      setSource("detected");
      setStatus("found");
    } catch (error) {
      if (!controller.signal.aborted) setStatus(error instanceof LocationError ? error.kind : "lookupFailed");
    }
  }

  function edited() {
    setSource("manual");
    if (status === "found") setStatus("idle");
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    lookup.current?.abort();
    const market = markets.find((m) => m.code === countryChoice);
    const country = market ? market.label : countryChoice === "other" ? otherCountry.trim() : "";
    const countryCode = market ? market.code : countryChoice === "other" && country ? otherCode : "";
    const cityName = city.trim();
    onDone(cityName || country ? { city: cityName, countryCode, country, source } : null);
  }

  const messages: Record<Exclude<Status, "idle">, string> = {
    locating: text.locating,
    found: text.locationFound,
    denied: text.locationDenied,
    timeout: text.locationTimeout,
    unavailable: text.locationUnavailable,
    unsupported: text.locationUnsupported,
    lookupFailed: text.lookupFailed,
  };

  return <form onSubmit={handleSubmit} className="capture-form" noValidate>
    <h1 tabIndex={-1}>{text.locationTitle}</h1>
    <p className="capture-lede capture-centered">{text.locationLede}</p>
    <button type="button" className="btn btn-outline" onClick={detect} disabled={status === "locating"}><Icon name="pin" size={16}/>{text.detectLocation}</button>
    <p className="capture-note">{text.locationDisclosure.replace("{provider}", reverseGeocoder.name)}</p>
    <p className="capture-note capture-location-status" role="status" aria-live="polite">{status !== "idle" && messages[status]}</p>
    <label>{text.city}<input value={city} onChange={(e) => { setCity(e.target.value); edited(); }} placeholder={text.cityPlaceholder} maxLength={80} autoComplete="address-level2"/></label>
    <label>{text.countryLabel}
      <select value={countryChoice} onChange={(e) => { setCountryChoice(e.target.value); setOtherCode(""); edited(); }}>
        <option value="">{text.chooseCountry}</option>
        {markets.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
        <option value="other">{text.otherCountry}</option>
      </select>
    </label>
    {countryChoice === "other" && <label>{text.otherCountryName}<input value={otherCountry} onChange={(e) => { setOtherCountry(e.target.value); setOtherCode(""); edited(); }} maxLength={80} autoComplete="country-name"/></label>}
    <button type="submit" className="btn btn-white capture-submit">{text.continue}</button>
    <button type="button" className="capture-skip" onClick={() => { lookup.current?.abort(); onDone(null); }}>{text.skipLocation}</button>
  </form>;
}
