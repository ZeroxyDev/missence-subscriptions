/**
 * @file MISSENCE brand images (horizontal wordmark and square mark).
 *
 * @module components/brand/brand-logo
 */

import Image from "next/image";

import { SITE_CONFIG } from "@/config/site";

/** Props shared by the brand images. */
type BrandImageProps = {
  /** Accessible text; use `""` when the image is decorative. */
  alt: string;
  /** Sizing and styling classes. */
  className: string;
};

/**
 * Renders the horizontal MISSENCE wordmark.
 *
 * @param props - Alt text and classes.
 * @returns A Next.js `Image`.
 */
export function BrandWordmark({ alt, className }: BrandImageProps) {
  return (
    <Image
      src={SITE_CONFIG.brand.logo}
      alt={alt}
      width={1920}
      height={211}
      className={className}
    />
  );
}

/**
 * Renders the square MISSENCE mark.
 *
 * @param props - Alt text and classes.
 * @returns A Next.js `Image`.
 */
export function BrandMark({ alt, className }: BrandImageProps) {
  return (
    <Image
      src={SITE_CONFIG.brand.mark}
      alt={alt}
      width={1200}
      height={1200}
      className={className}
    />
  );
}
