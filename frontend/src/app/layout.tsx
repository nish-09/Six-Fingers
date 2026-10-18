import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIX FINGERS — Multiplayer Hand Cricket with Webcams & AI Commentary",
  description: "Play authentic hand cricket online with friends using live webcams, MediaPipe computer vision finger tracking, private decision locking, simultaneous reveal, and multilingual commentary.",
  keywords: ["hand cricket", "cricket game", "multiplayer webcams", "mediapipe hand detection", "webrtc game", "six fingers"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🏏</text></svg>" />
      </head>
      <body className="antialiased selection:bg-[#F000A8] selection:text-white">
        {children}
      </body>
    </html>
  );
}
