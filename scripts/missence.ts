/**
 * @file `pnpm missence` — interactive project task runner.
 *
 * Wraps the package scripts in a menu (or runs one directly, e.g.
 * `pnpm missence check`) using whichever package manager invoked it.
 *
 * @module scripts/missence
 */

import {
  cancel,
  intro,
  isCancel,
  log,
  outro,
  select,
} from "@clack/prompts";
import { spawn } from "node:child_process";

/** Menu entries mapped to `package.json` scripts. Labels are user-facing (Spanish). */
const COMMANDS = {
  dev: {
    label: "Iniciar desarrollo",
    hint: "next dev",
    script: "dev",
  },
  typecheck: {
    label: "Comprobar TypeScript",
    hint: "sin generar archivos",
    script: "typecheck",
  },
  lint: {
    label: "Ejecutar ESLint",
    hint: "calidad y convenciones",
    script: "lint",
  },
  test: {
    label: "Ejecutar tests",
    hint: "tests TypeScript con tsx",
    script: "test",
  },
  check: {
    label: "Comprobar todo",
    hint: "types + lint + tests",
    script: "check",
  },
  docs: {
    label: "Validar documentación",
    hint: "estándar JSDoc + referencia al día",
    script: "docs:check",
  },
  "dry-run": {
    label: "Probar conexión con Bigblue",
    hint: "solo lectura, no modifica pedidos",
    script: "dry-run:bigblue",
  },
  build: {
    label: "Crear build de producción",
    hint: "validación final de Next.js",
    script: "build",
  },
} as const;

/** Name of a menu command. */
type CommandName = keyof typeof COMMANDS;
/** Supported package managers. */
type PackageManager = "bun" | "npm" | "pnpm" | "yarn";

/**
 * Narrows a CLI argument to a known command.
 *
 * @param value - Lower-cased argument.
 * @returns `true` when the command exists.
 */
function isCommandName(value: string): value is CommandName {
  return value in COMMANDS;
}

/**
 * Detects the invoking package manager from `npm_config_user_agent`.
 *
 * @returns The package manager, defaulting to `npm`.
 */
function detectPackageManager(): PackageManager {
  const userAgent = process.env.npm_config_user_agent ?? "";

  if (userAgent.startsWith("pnpm/")) return "pnpm";
  if (userAgent.startsWith("yarn/")) return "yarn";
  if (userAgent.startsWith("bun/")) return "bun";
  return "npm";
}

/**
 * Prints usage and the command list.
 *
 * @returns Nothing.
 */
function printHelp(): void {
  const commands = Object.entries(COMMANDS)
    .map(([name, command]) => `  ${name.padEnd(10)} ${command.label}`)
    .join("\n");

  console.log(`Uso:
  pnpm missence [comando]

Comandos:
${commands}
  help       Mostrar esta ayuda`);
}

/**
 * Shows the interactive command menu.
 *
 * @returns The chosen command, or `null` if the user cancelled.
 */
async function chooseCommand(): Promise<CommandName | null> {
  const selected = await select<CommandName>({
    message: "¿Qué quieres hacer?",
    options: Object.entries(COMMANDS).map(([value, command]) => ({
      value: value as CommandName,
      label: command.label,
      hint: command.hint,
    })),
  });

  if (isCancel(selected)) {
    cancel("Operación cancelada.");
    return null;
  }

  return selected as CommandName;
}

/**
 * Runs a package script with inherited stdio.
 *
 * @param packageManager - Executable to use.
 * @param script - `package.json` script name.
 * @returns The child's exit code (1 if it was killed by a signal).
 */
function runPackageScript(
  packageManager: PackageManager,
  script: string,
): Promise<number> {
  const executable =
    process.platform === "win32" ? `${packageManager}.cmd` : packageManager;

  return new Promise((resolve, reject) => {
    const child = spawn(executable, ["run", script], {
      stdio: "inherit",
      env: process.env,
    });

    child.once("error", reject);
    child.once("close", (code) => resolve(code ?? 1));
  });
}

/**
 * CLI entry point.
 *
 * @returns Resolves when the selected command finishes; sets `process.exitCode` on failure.
 */
async function main(): Promise<void> {
  const argument = process.argv[2]?.toLowerCase();

  if (argument === "help" || argument === "--help" || argument === "-h") {
    printHelp();
    return;
  }

  if (argument && !isCommandName(argument)) {
    console.error(`Comando desconocido: ${argument}\n`);
    printHelp();
    process.exitCode = 1;
    return;
  }

  intro("MISSENCE · project tools");
  const commandName: CommandName | null = argument
    ? (argument as CommandName)
    : await chooseCommand();

  if (!commandName) {
    return;
  }

  const command = COMMANDS[commandName];
  const packageManager = detectPackageManager();
  log.info(`${command.label} · ${packageManager} run ${command.script}`);

  const exitCode = await runPackageScript(packageManager, command.script);

  if (exitCode !== 0) {
    cancel(`El comando terminó con código ${exitCode}.`);
    process.exitCode = exitCode;
    return;
  }

  outro("Listo.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Error desconocido";
  cancel(message);
  process.exitCode = 1;
});
