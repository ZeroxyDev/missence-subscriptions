import { BrandWordmark } from "@/components/operations/brand-wordmark";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-missence-bg text-missence-text">
      <div className="h-0.5 bg-missence-accent" />

      <header className="px-6 py-6 md:px-10 md:py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <BrandWordmark />
          <div className="flex items-center gap-2 text-xs text-missence-muted">
            <span className="size-2 rounded-full bg-missence-accent" />
            Activa
          </div>
        </div>
      </header>

      <main className="flex flex-1 px-6 md:px-10">
        <section className="mx-auto flex w-full max-w-6xl flex-col justify-center py-24">
          <p className="mb-6 text-xs tracking-[0.08em] text-missence-muted uppercase">
            MISSENCE
          </p>
          <h1 className="max-w-5xl text-[clamp(4rem,12vw,9rem)] leading-[0.88] font-normal tracking-[-0.07em]">
            Suscripciones<span className="text-missence-accent">.</span>
          </h1>
          <p className="mt-10 max-w-lg text-lg leading-relaxed text-missence-muted md:text-xl">
            Los primeros envíos de nuestras suscripciones se gestionan desde
            aquí.
          </p>

          <div className="mt-20 flex max-w-lg items-center justify-between border-t border-missence-border pt-5 text-sm md:mt-28">
            <span>Todo funciona con normalidad</span>
            <span className="text-missence-accent" aria-hidden="true">
              ●
            </span>
          </div>
        </section>
      </main>

      <footer className="px-6 py-6 text-xs text-missence-muted md:px-10 md:py-8">
        <div className="mx-auto flex max-w-6xl justify-between">
          <span>MISSENCE</span>
          <span>Suscripciones</span>
        </div>
      </footer>
    </div>
  );
}
