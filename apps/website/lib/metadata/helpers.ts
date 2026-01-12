import type { Metadata } from "next";
import { siteConfig } from "./config";
import type { PageMetadataOptions } from "./types";

function buildAbsoluteUrl(url: string | undefined): string {
  if (!url) return siteConfig.url;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${siteConfig.url}${url.startsWith("/") ? url : `/${url}`}`;
}

export function generatePageMetadata(
  options: PageMetadataOptions
): Metadata {
  const {
    title,
    description,
    keywords,
    url,
    image,
    imageWidth = 1200,
    imageHeight = 630,
    imageAlt,
    type = "website",
    publishedTime,
    modifiedTime,
    authors,
    section,
    tags,
    robots,
    index = true,
    follow = true,
    additionalMetadata,
  } = options;

  const pageUrl = url ? buildAbsoluteUrl(url) : siteConfig.url;
  const ogImage = image
    ? buildAbsoluteUrl(image)
    : `${siteConfig.url}${siteConfig.ogImage}`;

  const formattedTitle = title.endsWith(" | Nexxa") ? title : `${title} | Nexxa`;
  const imageAltText = imageAlt || formattedTitle;

  const openGraphConfig: Metadata["openGraph"] = {
    type,
    locale: siteConfig.locale,
    url: pageUrl,
    siteName: siteConfig.name,
    title: formattedTitle,
    description: description || siteConfig.description,
    images: [
      {
        url: ogImage,
        width: imageWidth,
        height: imageHeight,
        alt: imageAltText,
      },
    ],
    ...(type === "article" && {
      publishedTime,
      modifiedTime,
      authors: authors || [siteConfig.name],
      section,
      tags,
    }),
  };

  const metadata: Metadata = {
    title: formattedTitle,
    description: description || siteConfig.description,
    ...(keywords && { keywords }),
    ...(url && {
      alternates: {
        canonical: pageUrl,
      },
    }),
    openGraph: openGraphConfig,
    twitter: {
      card: "summary_large_image",
      title: formattedTitle,
      description: description || siteConfig.description,
      creator: siteConfig.twitterHandle,
      images: [ogImage],
    },
    robots: robots || {
      index,
      follow,
      googleBot: {
        index,
        follow,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    ...additionalMetadata,
  };

  return metadata;
}

export function generateArticleMetadata(
  options: PageMetadataOptions & {
    publishedTime: string;
    modifiedTime?: string;
    authors?: string[];
    section?: string;
    tags?: string[];
  }
): Metadata {
  return generatePageMetadata({
    ...options,
    type: "article",
  });
}

export function generateNoIndexMetadata(
  options: Omit<PageMetadataOptions, "index" | "robots">
): Metadata {
  return generatePageMetadata({
    ...options,
    index: false,
    follow: false,
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    },
  });
}
