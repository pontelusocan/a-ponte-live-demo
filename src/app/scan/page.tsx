import type { Metadata } from "next";
import ScanExperience from "@/components/scan/ScanExperience";

// Same title and description as the institutional site's /scan. The demo's
// layout keeps its noindex, so this route stays out of search like the rest.
export const metadata: Metadata = {
  title: "A PONTE — Brand Film",
  description: "A PONTE brand film.",
};

export default function ScanPage() {
  return <ScanExperience />;
}
