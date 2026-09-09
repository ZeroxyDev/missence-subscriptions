import {
  cancel,
  intro,
  isCancel,
  log,
  outro,
  select,
} from "@clack/prompts";
import { spawn } from "node:child_process";

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

type CommandName = keyof typeof COMMANDS;
type PackageManager = "bun" | "npm" | "pnpm" | "yarn";

function isCommandName(value: string): value is CommandName {
  return value in COMMANDS;
}

function detectPackageManager(): PackageManager {
  const userAgent = process.env.npm_config_user_agent ?? "";

  if (userAgent.startsWith("pnpm/")) return "pnpm";
  if (userAgent.startsWith("yarn/")) return "yarn";
  if (userAgent.startsWith("bun/")) return "bun";
  return "npm";
}

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
