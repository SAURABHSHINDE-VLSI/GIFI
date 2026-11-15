export default function manifest() {
  return {
    name: "HERZ — just the two of us",
    short_name: "HERZ",
    description: "A private call room for two.",
    start_url: "/app",
    display: "standalone" as const,
    background_color: "#12060c",
    theme_color: "#12060c",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any" as const,
      },
    ],
  };
}
