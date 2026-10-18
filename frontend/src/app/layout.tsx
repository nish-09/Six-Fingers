import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://sixfingers.game";
const googleVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || "";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Six Fingers — Two Hands. One Rivalry. Real-Time Multiplayer Hand Cricket",
    template: "%s | Six Fingers",
  },
  description:
    "Play Six Fingers, the competitive browser-based hand cricket game. Challenge friends, track gestures with your webcam, compete in tournaments and multi-match series, and climb global leaderboards.",
  keywords: [
    "hand cricket",
    "cricket game",
    "multiplayer hand cricket",
    "webcam cricket",
    "mediapipe hand tracking",
    "webrtc gaming",
    "six fingers",
    "browser cricket",
    "online cricket",
    "gully cricket online",
  ],
  authors: [{ name: "Six Fingers Engineering" }],
  creator: "Six Fingers",
  publisher: "Six Fingers",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Six Fingers",
    title: "Six Fingers — Two Hands. One Rivalry.",
    description:
      "Play authentic hand cricket online with friends using live webcams, MediaPipe computer vision hand tracking, and secret simultaneous reveals.",
    images: [
      {
        url: "/og-preview.png",
        width: 1200,
        height: 630,
        alt: "Six Fingers Multiplayer Hand Cricket Arena",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Six Fingers — Two Hands. One Rivalry.",
    description:
      "Competitive browser hand cricket with computer vision hand tracking, private decision locking, and real-time commentary.",
    creator: "@sixfingersgame",
    images: ["/og-preview.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: googleVerification || undefined,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "VideoGame",
  name: "Six Fingers",
  alternateName: "Six Fingers Hand Cricket",
  description:
    "A multiplayer browser-based hand cricket game with webcam computer vision gesture recognition, real-time WebRTC audio/video, secret simultaneous reveal, tournaments, and multi-match series.",
  genre: ["Sports", "Arcade", "Strategy", "Cricket"],
  url: siteUrl,
  playMode: "MultiPlayer",
  applicationCategory: "Game",
  operatingSystem: "Any modern web browser with camera support",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🏏</text></svg>"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased selection:bg-[#F000A8] selection:text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
