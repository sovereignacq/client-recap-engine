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
    default: "APEX TCG — Identify, serialize & grade trading cards",
    template: "%s · APEX TCG",
  },
  description:
    "Photograph the front and back of any sports or trading card to identify the set, year, number, and variant. Serialize, value, and track every card from intake to payout.",
  keywords: [
    "card grading",
    "card identification",
    "sports cards",
    "trading card game",
    "TCG grader",
    "card serialization",
    "fair market value",
    "card intake",
  ],
  openGraph: {
    type: "website",
    url: APP_URL,
    title: "APEX TCG — Identify, serialize & grade trading cards",
    description:
      "Photograph any card to identify it, then serialize, value, and track it from intake to payout.",
    siteName: "APEX TCG",
  },
  twitter: {
    card: "summary_large_image",
    title: "APEX TCG",
    description:
      "Photograph any card to identify it, then serialize, value, and track it from intake to payout.",
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
