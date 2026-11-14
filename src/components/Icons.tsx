import type { SVGProps } from "react";

export type IconName =
  | "mic"
  | "mic-off"
  | "camera"
  | "camera-off"
  | "screen"
  | "heart"
  | "hangup"
  | "link"
  | "flip"
  | "chat"
  | "logout"
  | "pip"
  | "play"
  | "pause"
  | "pen"
  | "sparkles"
  | "gallery"
  | "sync"
  | "volume-2"
  | "volume-x"
  | "tv"
  | "rewind"
  | "headphones"
  | "search"
  | "eraser"
  | "music"
  | "replay-10"
  | "forward-10"
  | "chevron-up"
  | "chevron-down";


const shapes: Record<IconName, React.ReactNode> = {
  mic: (
    <>
      <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
      <path d="M12 18v4" />
      <path d="M8 22h8" />
    </>
  ),
  "mic-off": (
    <>
      <path d="M9 5a3 3 0 0 1 5.9-.7" />
      <path d="M15 9.4V11a3 3 0 0 1-4.9 2.3" />
      <path d="M5 10v1a7 7 0 0 0 10.5 6.1" />
      <path d="M19 10v1a7 7 0 0 1-.9 3.4" />
      <path d="M12 18v4" />
      <path d="M8 22h8" />
      <path d="M3 3l18 18" />
    </>
  ),
  camera: (
    <>
      <path d="M14 5H3a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z" />
      <path d="M22 7.5 15 11v2l7 3.5v-9z" />
    </>
  ),
  "camera-off": (
    <>
      <path d="M15 15.5V18a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2" />
      <path d="M9.5 5H14a1 1 0 0 1 1 1v4.5" />
      <path d="M22 7.5 15 11v2l7 3.5v-9z" />
      <path d="M3 3l18 18" />
    </>
  ),
  screen: (
    <>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
    </>
  ),
  heart: (
    <path
      d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
      fill="currentColor"
      stroke="none"
    />
  ),
  hangup: (
    <g transform="rotate(135 12 12)">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2.1z" />
    </g>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
    </>
  ),
  flip: (
    <>
      <path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.4-2.6L3 16" />
      <path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.4 2.6L21 8" />
      <path d="M3 21v-5h5" />
      <path d="M21 3v5h-5" />
    </>
  ),
  chat: (
    <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.9L3 20.5l1.5-4.3A8.4 8.4 0 0 1 3.5 11a8.4 8.4 0 0 1 8.5-8.3 8.4 8.4 0 0 1 9 8.5z" />
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
  pip: (
    <>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <rect x="11" y="9" width="9" height="6" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  play: (
    <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none" />
  ),
  pause: (
    <>
      <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" />
      <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  pen: (
    <>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </>
  ),
  eraser: (
    <>
      <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
      <path d="M22 21H7" />
      <path d="m5 11 9 9" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3l1.9 4.8 4.8 1.9-4.8 1.9L12 17l-1.9-4.8L5.3 10.3l4.8-1.9z" />
      <path d="M19 16l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
    </>
  ),
  gallery: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </>
  ),
  sync: (
    <>
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </>
  ),
  "volume-2": (
    <>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </>
  ),
  "volume-x": (
    <>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
      <line x1="22" y1="9" x2="16" y2="15" />
      <line x1="16" y1="9" x2="22" y2="15" />
    </>
  ),
  tv: (
    <>
      <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
      <polyline points="17 2 12 7 7 2" />
    </>
  ),
  rewind: (
    <>
      <polygon points="11 19 2 12 11 5 11 19" fill="currentColor" stroke="none" />
      <polygon points="22 19 13 12 22 5 22 19" fill="currentColor" stroke="none" />
    </>
  ),
  headphones: (
    <>
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </>
  ),
  "replay-10": (
    <>
      <path d="M12 5a7 7 0 1 0 6.6 4.6" />
      <polygon points="12 1 12 7 7 4" fill="currentColor" stroke="none" />
      <text x="12" y="15" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="currentColor" stroke="none" fontFamily="system-ui, sans-serif">10</text>
    </>
  ),
  "forward-10": (
    <>
      <path d="M12 5a7 7 0 1 1-6.6 4.6" />
      <polygon points="12 1 12 7 17 4" fill="currentColor" stroke="none" />
      <text x="12" y="15" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="currentColor" stroke="none" fontFamily="system-ui, sans-serif">10</text>
    </>
  ),
  "chevron-up": (
    <polyline points="18 15 12 9 6 15" />
  ),
  "chevron-down": (
    <polyline points="6 9 12 15 18 9" />
  ),
};

export function Icon({
  name,
  size = 22,
  ...rest
}: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {shapes[name]}
    </svg>
  );
}
