import type { Metadata } from "next";

export const siteConfig = {
  name: "Nexxa",
  description:
    "Professional trading signals platform. Get premium trading alerts and market insights to improve your trading performance.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://nexxa.trade",
  ogImage: "/og-image.png",
  twitterHandle: "@nexxatrade",
  locale: "en_US",
  type: "website" as const,
} as const;

export const defaultMetadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: `%s | Nexxa`,
  },
  description: siteConfig.description,
  keywords: [
    "trading signals",
    "trading alerts",
    "forex signals",
    "crypto signals",
    "stock signals",
    "trading tips",
    "market analysis",
    "trading platform",
    "investment signals",
    "trading insights",
  ],
  authors: [{ name: siteConfig.name }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: siteConfig.type,
    locale: siteConfig.locale,
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
    images: [
      {
        url: `${siteConfig.url}${siteConfig.ogImage}`,
        width: 1200,
        height: 630,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    creator: siteConfig.twitterHandle,
    images: [`${siteConfig.url}${siteConfig.ogImage}`],
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
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};
