/**
 * @file Public site metadata and brand assets.
 *
 * Safe to import from client components: contains no secrets.
 *
 * @module config/site
 */

/** Branding and attribution shown on the operations landing page. */
export const SITE_CONFIG = {
  name: "MISSENCE",
  title: "MISSENCE Subscriptions",
  description: "Gestión de suscripciones de MISSENCE.",
  brand: {
    /** Horizontal wordmark served from `public/`. */
    logo: "/brand/logo_long.webp",
    /** Square brand mark used as favicon and decorative accent. */
    mark: "/brand/logo.png",
  },
  developer: {
    githubUsername: "zeroxydev",
    githubUrl: "https://github.com/zeroxydev",
    /** Remote avatar; its origin is allow-listed in `next.config.ts`. */
    avatarUrl: "https://github.com/zeroxydev.png",
  },
} as const;
