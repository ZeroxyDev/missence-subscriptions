/**
 * @file Page header with the MISSENCE wordmark.
 *
 * @module components/layout/site-header
 */

import { BrandWordmark } from "@/components/brand/brand-logo";
import { SITE_CONFIG } from "@/config/site";

/**
 * Renders the site header.
 *
 * @returns The `<header>` element.
 */
export function SiteHeader() {
  return (
    <header className="px-6 py-6 md:px-10 md:py-8">
      <div className="mx-auto max-w-6xl">
        <BrandWordmark alt={SITE_CONFIG.name} className="h-auto w-36 md:w-40" />
      </div>
    </header>
  );
}
