"use client";

import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import Icon from "@/components/Icon";
import type { Text } from "@/components/Experience";
import { getApproximatePosition, LocationError, type LocationErrorKind, type ShareLocation } from "@/lib/share/location";
import { reverseGeocoder } from "@/lib/share/reverse-geocode";

type Status = "idle" | "locating" | "found" | LocationErrorKind;

// Upper bound for the whole lookup, permission prompt included: some browsers never answer when
// their prompt is simply dismissed, and the loader must not spin forever.
const GIVE_UP_MS = 30_000;

const GLASS_BOWL = "M13 6H35C36.4 17 35.2 29.5 24 32.5C12.8 29.5 11.6 17 13 6Z";

// Outline of a wine glass whose bowl fills with wine and empties again while the location is
// looked up (.wine-* in globals.css). The wine is a wave clipped to the bowl; only it moves.
function WineGlassLoader() {
  // Safe inside url(#…) references.
  const id = `glass${useId().replace(/[^\w-]/g, "")}`;
  return <svg className="wine-glass" viewBox="0 0 48 72" aria-hidden="true">
    <defs>
      <clipPath id={`${id}bowl`}><path d={GLASS_BOWL}/></clipPath>
      <linearGradient id={`${id}wine`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9e2236"/><stop offset="1" stopColor="#5a0e1b"/></linearGradient>
    </defs>
    <g clipPath={`url(#${id}bowl)`}>
      <g className="wine-level"><path className="wine-wave" fill={`url(#${id}wine)`} d="M0 0Q6-1.6 12 0T24 0T36 0T48 0T60 0T72 0V40H0Z"/></g>
    </g>
    <path className="wine-glass-outline" d={`${GLASS_BOWL}M24 32.5V60M15 63Q24 59.6 33 63`}/>
  </svg>;
}

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
    const giveUp = window.setTimeout(() => {
      if (lookup.current !== controller || controller.signal.aborted) return;
      controller.abort();
      setStatus("timeout");
    }, GIVE_UP_MS);
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
    } finally {
      window.clearTimeout(giveUp);
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
    {status === "locating" && <WineGlassLoader/>}
    <p className={`capture-note capture-location-status ${status === "locating" ? "is-locating" : ""}`} role="status" aria-live="polite">{status !== "idle" && messages[status]}</p>
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
