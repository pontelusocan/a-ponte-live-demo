"use client";
import Script from "next/script";
import {useEffect, useRef, useState} from "react";

type Turnstile = {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  remove(id: string): void;
};
declare global { interface Window { turnstile?: Turnstile } }

export default function UploadVerification({attempt, language, onToken}: {attempt: number; language: string; onToken: (token: string) => void}) {
  const container = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken);
  callback.current = onToken;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const api = window.turnstile;
    const el = container.current;
    if (!ready || !api || !el) return;
    callback.current("");
    const id = api.render(el, {
      sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
      action: "live_submission", theme: "dark", language: language.toLowerCase(),
      callback: (token: string) => callback.current(token),
      "expired-callback": () => callback.current(""),
      "error-callback": () => callback.current(""),
    });
    return () => { api.remove(id); };
  }, [ready, attempt, language]);
  return <><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={() => setReady(true)}/><div ref={container}/></>;
}
