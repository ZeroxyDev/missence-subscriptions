import Image from "next/image";

import { IntegrationStatus } from "@/components/operations/integration-status";
import { SITE_CONFIG } from "@/config/site";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-missence-bg text-missence-text">
      <div className="h-0.5 bg-missence-accent" />

      <header className="px-6 py-6 md:px-10 md:py-8">
        <div className="mx-auto max-w-6xl">
          <Image
            src={SITE_CONFIG.brand.logo}
            alt={SITE_CONFIG.name}
            width={1920}
            height={211}
            className="h-auto w-36 md:w-40"
          />
        </div>
      </header>

      <main className="flex flex-1 px-6 md:px-10">
        <section className="mx-auto flex w-full max-w-6xl flex-col justify-center py-24">
          <Image
            src={SITE_CONFIG.brand.mark}
            alt=""
            width={1200}
            height={1200}
            className="mb-8 size-12 rounded-missence-sm md:size-14"
          />
          <h1 className="max-w-5xl text-[clamp(4rem,12vw,9rem)] leading-[0.88] font-normal tracking-[-0.07em]">
            Suscripciones<span className="text-missence-accent">.</span>
          </h1>
          <p className="mt-10 max-w-lg text-lg leading-relaxed text-missence-muted md:text-xl">
            Los primeros envíos de nuestras suscripciones se gestionan desde
            aquí.
          </p>
        </section>
      </main>

      <footer className="px-6 py-6 text-xs text-missence-muted md:px-10 md:py-8">
        <div className="mx-auto grid max-w-6xl grid-cols-2 items-center gap-8 md:grid-cols-3">
          <Image
            src={SITE_CONFIG.brand.logo}
            alt=""
            width={1920}
            height={211}
            className="h-auto w-24 shrink-0 opacity-50"
          />
          <IntegrationStatus />
          <a
            href={SITE_CONFIG.developer.githubUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-self-end gap-3 transition-opacity hover:opacity-60"
          >
            <span className="text-right leading-tight">
              <span className="block text-[10px] text-missence-muted">
                Desarrollado por
              </span>
              <span className="block text-xs text-missence-text">
                @{SITE_CONFIG.developer.githubUsername}
              </span>
            </span>
            <Image
              src={SITE_CONFIG.developer.avatarUrl}
              alt={`Foto de perfil de ${SITE_CONFIG.developer.githubUsername}`}
              width={40}
              height={40}
              className="size-10 rounded-full object-cover"
            />
          </a>
        </div>
      </footer>
    </div>
  );
}
