import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
// Self-hosted pixel faces: one chunky UI face with unambiguous digits, one caps label face, one LED face.
const ui = localFont({
  src: "../fonts/Tiny5.woff2",
  variable: "--font-ui",
  weight: "400",
  display: "swap",
});
const label = localFont({
  src: [
    { path: "../fonts/Silkscreen-Regular.woff2", weight: "400" },
    { path: "../fonts/Silkscreen-Bold.woff2", weight: "700" },
  ],
  variable: "--font-label",
  display: "swap",
});
const led = localFont({
  src: "../fonts/VT323.woff2",
  variable: "--font-led",
  weight: "400",
  display: "swap",
});
export const metadata: Metadata = {
  title: "TAG: hide and seek on campus",
  description:
    "Hide and seek on your phone. A safe zone on the map keeps shrinking.",
  applicationName: "TAG",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TAG",
  },
  icons: { icon: "/icons/icon.svg", apple: "/icons/apple-touch-icon.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0a1230",
  viewportFit: "cover",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${ui.variable} ${label.variable} ${led.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
