import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";

import { getViewer } from "@/lib/auth/session";

import { ClientProviders } from "@/components/providers/client-providers";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "D3T",
    template: "%s | D3T",
  },
  description: "A Vercel-ready web platform for three-layer Grandfather Tic-Tac-Toe.",
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
