import type { Metadata } from "next";
import type { ReactNode } from "react";
import { barlow } from "@/lib/fonts";
import "./globals.css";
import "./brand.css";
import "./cinematic.css";
import "./private-circle.css";

export const metadata: Metadata = {
  title: "A PONTE LIVE — Interactive Experience Concept",
  description: "A private, mobile-first frontend prototype for review. No uploads, QR tracking or analytics are active.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en" className={barlow.variable}>
    <head>
      {/* New Title (Indian Type Foundry), served by Fontshare's official CSS API. Only the
          Regular (400) cut is requested: every NewTitle heading uses it, and a heavier cut in
          the same family would replace the weight-900 rendering of the gradient titles. */}
      <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="anonymous"/>
      <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=new-title@400&display=swap"/>
      {/* Same flag-sprite stylesheet the institutional site loads for its language switcher. */}
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/css/flag-icons.min.css"/>
    </head>
    <body>{children}</body>
  </html>;
}
