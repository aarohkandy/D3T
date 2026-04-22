import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";

import { getViewer } from "@/lib/auth/session";

import { ClientProviders } from "@/components/providers/client-providers";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const metadataBase = new URL(siteUrl);

export const metadata: Metadata = {
  title: {
    default: "D3T",
    template: "%s | D3T",
  },
  metadataBase,
  description: "D3T is a challenge-first web platform for three-layer Grandfather Tic-Tac-Toe.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "D3T",
    url: "/",
    title: "D3T",
    description: "Challenge-first three-layer Grandfather Tic-Tac-Toe on the web.",
    images: [
      {
        url: "/press/d3t-og.svg",
        width: 1200,
        height: 630,
        alt: "D3T launch card",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "D3T",
    description: "Challenge-first three-layer Grandfather Tic-Tac-Toe on the web.",
    images: ["/press/d3t-og.svg"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const viewer = await getViewer();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className={`${GeistSans.className} min-h-full bg-[color:var(--color-bg)] text-[color:var(--color-ink)]`}
      >
        <div className="app-shell min-h-screen">
          <SiteHeader viewer={viewer} />
          <div className="relative min-h-screen">{children}</div>
        </div>
        <ClientProviders />
      </body>
    </html>
  );
}
