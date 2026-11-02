import type { NextConfig } from "next";

// GitHub Pages serves this demo from /a-ponte-live-demo; the deploy workflow sets
// PAGES_BASE_PATH. Without it (npm run dev, local builds) the app runs at the root.
const basePath = process.env.PAGES_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  // next/link, the router and next/font add basePath themselves; plain <img> and
  // CSS url() paths to public/ files read it from here (asset() in Experience.tsx).
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
