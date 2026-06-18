import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://client-recap-engine.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Sovereign Grading — Identify, serialize & grade trading cards",
    template: "%s · Sovereign Grading",
  },
  description:
    "Snap a photo and identify any sports or trading card with AI — set, year, number, and variant. Serialize, value, and track every card from intake to payout. Powered by Gemini 2.5.",
  keywords: [
    "card grading",
    "card identification",
    "sports cards",
    "trading card game",
    "PSA",
    "card serialization",
    "fair market value",
    "card intake",
  ],
  openGraph: {
    type: "website",
    url: APP_URL,
    title: "Sovereign Grading — Identify, serialize & grade trading cards",
    description:
      "Snap a photo and identify any card with AI, then serialize, value, and track it from intake to payout.",
    siteName: "Sovereign Grading",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sovereign Grading",
    description:
      "Snap a photo and identify any card with AI, then serialize, value, and track it from intake to payout.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
