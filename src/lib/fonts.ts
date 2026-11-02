import localFont from "next/font/local";

/**
 * Barlow is declared as in the institutional site's src/lib/fonts.ts, from the
 * OFL-licensed files in public/fonts/; the build fails loudly if one is missing,
 * rather than silently falling back to Arial. New Title is not distributed with
 * this repository: layout.tsx loads it from Fontshare's official CSS API.
 */

/** Body copy: Barlow Light (300) for text, Regular (400) for buttons/controls. */
export const barlow = localFont({
  src: [
    { path: "../../public/fonts/Barlow-Light.ttf", weight: "300", style: "normal" },
    { path: "../../public/fonts/Barlow-Regular.ttf", weight: "400", style: "normal" },
  ],
  variable: "--font-barlow",
  display: "swap",
});
