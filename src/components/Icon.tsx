import type { ReactNode } from "react";

export default function Icon({ name, size = 19, stroke = 1.6 }: { name: string; size?: number; stroke?: number }) {
  const paths: Record<string, ReactNode> = {
    person: <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
    engagement: <><path d="M4 19V5m0 14h16"/><path className="circle-arrow" pathLength={1} d="M8 15l4-4 3 2 5-6m-4 0h4v4"/></>,
    unlock: <><path className="circle-shackle" d="M8 10V7a4 4 0 0 1 8 0v3"/><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M12 14v3"/></>,
    compass: <><circle cx="12" cy="12" r="9"/><path d="m16 8-2.6 5.4L8 16l2.6-5.4L16 8Z"/></>,
    images: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 16-5.5-5.5L5 21"/></>,
    plus: <><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></>,
    play: <path d="m8.5 5.5 10 6.5-10 6.5v-13Z"/>,
    arrow: <><path d="M4 12h16"/><path d="m14 6 6 6-6 6"/></>,
    left: <><path d="m15 18-6-6 6-6"/></>,
    back: <><path d="M20 12H4"/><path d="m10 18-6-6 6-6"/></>,
    right: <><path d="m9 18 6-6-6-6"/></>,
    x: <><path d="m5 5 14 14M19 5 5 19"/></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    camera: <><path d="M3 7h4l2-2h6l2 2h4v12H3z"/><circle cx="12" cy="13" r="3"/></>,
    globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></>,
    check: <><path d="m5 12 4.5 4.5L19 7"/></>,
    upload: <><path d="M12 16V3m-5 5 5-5 5 5"/><path d="M4 17v4h16v-4"/></>,
    external: <><path d="M10 5H5v14h14v-5"/><path d="M14 5h5v5M19 5l-9 9"/></>,
    wine: <><path d="M7 3h10v5c0 4-2 6-5 6S7 12 7 8V3ZM12 14v7m-5 0h10M7 8h10"/></>,
    circle: <><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.compass}</svg>;
}
