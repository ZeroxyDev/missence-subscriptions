/**
 * @file Hero section of the operations landing page.
 *
 * @module components/home/home-hero
 */

import { BrandMark } from "@/components/brand/brand-logo";

/**
 * Renders the headline and short description (Spanish, user-facing).
 *
 * @returns The hero `<section>`.
 */
export function HomeHero() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col justify-center py-24">
      <BrandMark alt="" className="mb-8 size-12 rounded-missence-sm md:size-14" />
      <h1 className="max-w-5xl text-[clamp(4rem,12vw,9rem)] leading-[0.88] font-normal tracking-[-0.07em]">
        Suscripciones<span className="text-missence-accent">.</span>
      </h1>
      <p className="mt-10 max-w-lg text-lg leading-relaxed text-missence-muted md:text-xl">
        Los primeros envíos de nuestras suscripciones se gestionan desde
        aquí.
      </p>
    </section>
  );
}
