import type { Metadata } from "next";
import { Noto_Sans_KR, Orbitron, Geist_Mono } from "next/font/google";

import { GlobalNav } from "@/shared/layout/global-nav";
import "./globals.css";

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
  title: "Endfield Essence Guide",
  description:
    "Screen-share based essence scanning and farming recommendations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`dark ${notoSansKr.variable} ${orbitron.variable} ${geistMono.variable}`}
    >
      <body className="font-sans antialiased">
        <GlobalNav />
        {children}
      </body>
    </html>
  );
}
