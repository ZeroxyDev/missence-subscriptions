/**
 * @file Page footer: brand mark, live integration status and developer credit.
 *
 * Server component; only the integration status inside it hydrates on the client.
 *
 * @module components/layout/site-footer
 */

import { BrandWordmark } from "@/components/brand/brand-logo";
import { DeveloperCredit } from "@/components/layout/developer-credit";
import { IntegrationStatus } from "@/components/operations/integration-status/integration-status";

/**
 * Renders the three-column footer (two columns on mobile, status on its own row).
 *
 * @returns The `<footer>` element.
 */
export function SiteFooter() {
  return (
    <footer className="px-6 py-6 text-xs text-missence-muted md:px-10 md:py-8">
      <div className="mx-auto grid max-w-6xl grid-cols-2 items-center gap-8 md:grid-cols-3">
        <BrandWordmark alt="" className="h-auto w-24 shrink-0 opacity-50" />
        <IntegrationStatus />
        <DeveloperCredit />
      </div>
    </footer>
  );
}
