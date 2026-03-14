import type { Metadata } from "next";
import { Geist_Mono, Noto_Sans_KR, Orbitron } from "next/font/google";

import { GlobalFooter } from "@/shared/layout/global-footer";
import { GlobalNav } from "@/shared/layout/global-nav";
import {
  defaultDescription,
  defaultKeywords,
  defaultTitle,
  siteName,
  siteUrl,
} from "@/shared/lib/site";
import "./globals.css";
import { getManifest } from "@/shared/lib/data/server";

const notoSansKr = Noto_Sans_KR({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const orbitron = Orbitron({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: defaultTitle,
    template: "%s | 엔드필드 기질작 가이드",
  },
  description: defaultDescription,
  applicationName: siteName,
  keywords: defaultKeywords,
  alternates: {
    canonical: "/match",
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: siteUrl,
    siteName,
    title: defaultTitle,
    description: defaultDescription,
  },
  twitter: {
    card: "summary",
    title: defaultTitle,
    description: defaultDescription,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const manifest = await getManifest();
  return (
    <html
      lang="ko"
      className={`dark ${notoSansKr.variable} ${orbitron.variable} ${geistMono.variable}`}
    >
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <GlobalNav
          dataVersion={manifest.dataVersion}
          updatedAt={manifest.updatedAt}
        />
        <div className="flex-1">{children}</div>
        <GlobalFooter />
      </body>
    </html>
  );
}
