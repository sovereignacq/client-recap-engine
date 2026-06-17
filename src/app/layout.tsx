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
    default: "client-recap-engine — Send a client recap in under a minute",
    template: "%s · client-recap-engine",
  },
  description:
    "Paste your meeting notes. Pick a tone. Get a polished, ready-to-send recap email in seconds. Powered by Gemini 2.5.",
  keywords: [
    "client recap",
    "meeting notes",
    "AI email writer",
    "follow-up email",
    "client communication",
    "consultants",
    "freelancers",
  ],
  openGraph: {
    type: "website",
    url: APP_URL,
    title: "client-recap-engine — Send a client recap in under a minute",
    description:
      "Paste your meeting notes. Pick a tone. Get a polished, ready-to-send recap email in seconds.",
    siteName: "client-recap-engine",
  },
  twitter: {
    card: "summary_large_image",
    title: "client-recap-engine",
    description:
      "Paste your meeting notes. Pick a tone. Get a polished, ready-to-send recap email in seconds.",
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
