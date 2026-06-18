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
    default: "APEX TCG — Grade, buy & sell trading cards",
    template: "%s · APEX TCG",
  },
  description:
    "Grade your cards with precise identification, buy singles and rips from the floor, and sell what you own or pull to us at fair market value. One platform, end to end.",
  keywords: [
    "card grading",
    "card identification",
    "buy cards",
    "sell cards",
    "card rips",
    "sports cards",
    "trading card game",
    "fair market value",
  ],
  openGraph: {
    type: "website",
    url: APP_URL,
    title: "APEX TCG — Grade, buy & sell trading cards",
    description:
      "Grade, buy, and sell trading cards on one platform — precise identification, rips, and fair-market sell-to-us.",
    siteName: "APEX TCG",
  },
  twitter: {
    card: "summary_large_image",
    title: "APEX TCG",
    description:
      "Grade, buy, and sell trading cards on one platform — precise identification, rips, and fair-market sell-to-us.",
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
