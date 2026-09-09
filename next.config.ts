import type { NextConfig } from "next";
import { SITE_CONFIG } from "./config/site";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [new URL(SITE_CONFIG.developer.avatarUrl)],
    maximumRedirects: 1,
  },
};

export default nextConfig;
