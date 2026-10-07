import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
// One self-hosted pixel face for everything (every digit stays unambiguous).
const ui = localFont({
  src: "../fonts/Tiny5.woff2",
  variable: "--font-ui",
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
    <html lang="en" className={ui.variable}>
      <body>{children}</body>
    </html>
  );
}
