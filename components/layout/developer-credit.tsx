/**
 * @file "Developed by" credit linking to the developer's GitHub profile.
 *
 * @module components/layout/developer-credit
 */

import Image from "next/image";

import { SITE_CONFIG } from "@/config/site";

/**
 * Renders the developer credit with avatar (user-facing copy in Spanish).
 *
 * @returns An external link element.
 */
export function DeveloperCredit() {
  const { githubUrl, githubUsername, avatarUrl } = SITE_CONFIG.developer;

  return (
    <a
      href={githubUrl}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-self-end gap-3 transition-opacity hover:opacity-60"
    >
      <span className="text-right leading-tight">
        <span className="block text-[10px] text-missence-muted">
          Desarrollado por
        </span>
        <span className="block text-xs text-missence-text">
          @{githubUsername}
        </span>
      </span>
      <Image
        src={avatarUrl}
        alt={`Foto de perfil de ${githubUsername}`}
        width={40}
        height={40}
        className="size-10 rounded-full object-cover"
      />
    </a>
  );
}
