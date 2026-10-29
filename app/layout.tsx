/**
 * @file Root layout: document shell, global styles and site metadata.
 *
 * @module app/layout
 */

import type { Metadata } from "next";
import { SITE_CONFIG } from "@/config/site";
import "./globals.css";

/** Default `<head>` metadata for every page. */
export const metadata: Metadata = {
  title: SITE_CONFIG.title,
  description: SITE_CONFIG.description,
  icons: {
    icon: SITE_CONFIG.brand.mark,
    apple: SITE_CONFIG.brand.mark,
  },
};

/**
 * Wraps every page in the `<html>`/`<body>` shell (Spanish locale).
 *
 * @param props - Layout props; `children` is the active page.
 * @returns The document shell.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
