import type { Metadata, ResolvingMetadata } from "next";
import { generatePageMetadata } from "./helpers";
import type { GenerateMetadataOptions } from "./types";

export async function generateDynamicMetadata(
  options: GenerateMetadataOptions,
  parent?: ResolvingMetadata
): Promise<Metadata> {
  const parentMetadata = parent ? await parent : null;
  const metadata = generatePageMetadata(options);

  if (parentMetadata) {
    return {
      ...metadata,
      ...(parentMetadata.icons && { icons: parentMetadata.icons }),
      ...(parentMetadata.manifest && { manifest: parentMetadata.manifest }),
    };
  }

  return metadata;
}

export async function generateDynamicArticleMetadata(
  options: GenerateMetadataOptions & {
    publishedTime: string;
    modifiedTime?: string;
    authors?: string[];
    section?: string;
    tags?: string[];
  },
  parent?: ResolvingMetadata
): Promise<Metadata> {
  return generateDynamicMetadata(
    {
      ...options,
      type: "article",
    },
    parent
  );
}
