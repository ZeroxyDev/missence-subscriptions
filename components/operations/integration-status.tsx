"use client";

import { useEffect, useState } from "react";

import type { IntegrationHealth } from "@/lib/health/types";

const REFRESH_INTERVAL_MS = 60_000;

function isIntegrationHealth(value: unknown): value is IntegrationHealth {
  if (typeof value !== "object" || value === null || !("checks" in value)) {
    return false;
  }

  return Array.isArray(value.checks);
}

export function IntegrationStatus() {
  const [health, setHealth] = useState<IntegrationHealth | null>(null);
  const [requestFailed, setRequestFailed] = useState(false);

  useEffect(() => {
    let active = true;

    async function refreshHealth() {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        const value: unknown = await response.json();

        if (!response.ok || !isIntegrationHealth(value)) {
          throw new Error("Invalid health response");
        }

        if (active) {
          setHealth(value);
          setRequestFailed(false);
        }
      } catch {
        if (active) {
          setRequestFailed(true);
        }
      }
    }

    void refreshHealth();
    const interval = window.setInterval(refreshHealth, REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const failed = requestFailed || health?.status === "error";
  const label = health === null && !requestFailed
    ? "Comprobando estado"
    : failed
      ? "Hay una incidencia"
      : "Todo funciona con normalidad";

  return (
    <div className="group relative order-3 col-span-2 md:order-none md:col-span-1 md:justify-self-center">
      <button
        type="button"
        className="flex items-center gap-2 text-left"
        aria-live="polite"
        aria-describedby="integration-status-detail"
      >
        <span
          className={`size-1.5 rounded-full ${
            health === null && !requestFailed
              ? "bg-missence-border"
              : failed
                ? "bg-missence-text"
                : "bg-missence-accent"
          }`}
        />
        <span>{label}</span>
      </button>

      <div
        id="integration-status-detail"
        className="invisible absolute bottom-full left-0 z-20 mb-3 w-72 translate-y-1 rounded-missence-sm bg-missence-text p-4 text-missence-bg opacity-0 shadow-lg transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 md:left-1/2 md:-translate-x-1/2 md:group-hover:-translate-x-1/2 md:group-focus-within:-translate-x-1/2"
      >
        <p className="mb-3 text-[10px] uppercase tracking-[0.08em] text-missence-muted">
          Estado de la integración
        </p>
        {requestFailed ? (
          <p>No se pudo consultar el estado.</p>
        ) : health ? (
          <ul className="space-y-3">
            {health.checks.map((check) => (
              <li key={check.id} className="flex items-start justify-between gap-4">
                <span>{check.label}</span>
                <span className="text-right text-missence-muted">
                  {check.status === "error" ? check.detail : "Correcto"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>Comprobando conexiones…</p>
        )}
      </div>
    </div>
  );
}
