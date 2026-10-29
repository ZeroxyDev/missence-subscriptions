/**
 * @file Next.js configuration.
 *
 * @module next.config
 */

import type { NextConfig } from "next";
import { SITE_CONFIG } from "./config/site";

/** Allows only the developer avatar as a remote image origin. */
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [new URL(SITE_CONFIG.developer.avatarUrl)],
    maximumRedirects: 1,
  },
};

export default nextConfig;
