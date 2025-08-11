import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BeatSynced • One Image → Beat‑Reactive Video",
  description: "Upload one image + one song. Get a beat-synced motion video.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
