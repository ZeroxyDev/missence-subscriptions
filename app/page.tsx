/**
 * @file Operations landing page (`/`).
 *
 * Composes layout and home components; holds no markup of its own beyond the
 * page shell. User-facing copy is intentionally in Spanish.
 *
 * @module app/page
 */

import { HomeHero } from "@/components/home/home-hero";
import { AccentBar } from "@/components/layout/accent-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

/**
 * Renders the landing page: accent bar, header, hero and status footer.
 *
 * @returns The page element.
 */
export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-missence-bg text-missence-text">
      <AccentBar />
      <SiteHeader />
      <main className="flex flex-1 px-6 md:px-10">
        <HomeHero />
      </main>
      <SiteFooter />
    </div>
  );
}
