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
  | "thumbs-up"
  | "folded-hands";

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
  "thumbs-up": (
    <>
      <path d="M19 14.5V17a2 2 0 0 1-2 2H7a2 2 0 0 1-1.4-.6L3.5 15.8a1 1 0 0 1 .2-1.5l.2-.2a1 1 0 0 1 1.2-.2L10 14.2v-5.9a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v3.3l.7-.6a1 1 0 0 1 1.4.2l.6.6a1 1 0 0 1 .2 1.4L12 15.5a1 1 0 0 1-.8.8H5v2.5a1 1 0 0 0 1 1h1v2a5 5 0 0 0 9 0v-2h1a1 1 0 0 0 1-1v-2.5h2z" />
    </>
  ),
  "folded-hands": (
    <>
      <path d="M12 2C8 2 5 4 5 8v1c0 1 .2 2 .5 3l2.4 3.2c1.1 1.5 2.9 2.4 4.7 2.4h4.6c1.8 0 3.6-.9 4.7-2.4L18.5 12c.3-1 .5-2 .5-3v-1c0-4-3-6-7-6z" />
      <path d="M12 6c-2.2 0-4 1-5 2.5L3 13v1c0 1 .2 2 .5 3l2.4 3.2c1.1 1.5 2.9 2.4 4.7 2.4h4.6c1.8 0 3.6-.9 4.7-2.4L18.5 12v-1c-.3-1-.5-2-.5-3V8.5c-1-1.5-2.8-2.5-5-2.5z" />
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
