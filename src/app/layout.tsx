import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "TAG — The campus is your playground.",
  description:
    "Real-world hide-and-seek. A shrinking zone. Nowhere to stand still.",
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
  themeColor: "#111512",
  viewportFit: "cover",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
