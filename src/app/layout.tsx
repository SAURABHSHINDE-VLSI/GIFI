import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const display = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-display",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HERZ — just the two of us",
  description: "A private call room for two.",
  applicationName: "HERZ",
  appleWebApp: {
    capable: true,
    title: "HERZ",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#12060c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <head>
        <Script
          id="console-filter"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){
              if (typeof window === 'undefined') return;
              var orig = console.error;
              console.error = function() {
                var first = arguments && arguments[0];
                var str = typeof first === 'string' ? first : '';
                if (
                  str.indexOf('INFO:') === 0 ||
                  str.indexOf('TensorFlow Lite') !== -1 ||
                  str.indexOf('XNNPACK') !== -1 ||
                  str.indexOf('landmark_projection_calculator') !== -1 ||
                  str.indexOf('NORM_RECT') !== -1
                ) {
                  return;
                }
                return orig.apply(console, arguments);
              };
            })();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
