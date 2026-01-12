import type { Metadata } from "next";

export interface PageMetadataOptions {
  /** Título de la página */
  title: string;
  /** Descripción de la página */
  description?: string;
  /** Palabras clave específicas de la página */
  keywords?: string[];
  /** URL relativa o absoluta de la página */
  url?: string;
  /** Imagen Open Graph (relativa o absoluta) */
  image?: string;
  /** Ancho de la imagen Open Graph */
  imageWidth?: number;
  /** Alto de la imagen Open Graph */
  imageHeight?: number;
  /** Texto alternativo de la imagen */
  imageAlt?: string;
  /** Tipo de contenido Open Graph (por defecto: 'website') */
  type?: "website" | "article" | "profile" | "book";
  /** Fecha de publicación (para artículos) */
  publishedTime?: string;
  /** Fecha de modificación (para artículos) */
  modifiedTime?: string;
  /** Autores (para artículos) */
  authors?: string[];
  /** Sección del sitio (para artículos) */
  section?: string;
  /** Etiquetas (para artículos) */
  tags?: string[];
  /** Configuración de robots */
  robots?: Metadata["robots"];
  /** Si la página debe ser indexada (por defecto: true) */
  index?: boolean;
  /** Si los enlaces deben ser seguidos (por defecto: true) */
  follow?: boolean;
  /** Metadatos adicionales personalizados */
  additionalMetadata?: Partial<Metadata>;
}

export interface GenerateMetadataOptions extends PageMetadataOptions {
  /** Parámetros de la ruta dinámica */
  params?: Record<string, string | string[]>;
  /** Parámetros de búsqueda de la URL */
  searchParams?: Record<string, string | string[] | undefined>;
}
