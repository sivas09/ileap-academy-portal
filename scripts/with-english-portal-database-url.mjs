import "dotenv/config";
import { spawn } from "node:child_process";

const APP_SCHEMA = process.env.APP_DATABASE_SCHEMA || "english_portal";

function withAppSchema(rawUrl) {
  if (!rawUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }

  if (!["postgresql:", "postgres:"].includes(parsed.protocol)) {
    throw new Error("DATABASE_URL must use PostgreSQL for this app.");
  }

  const existingSchema = parsed.searchParams.get("schema");
  if (existingSchema && existingSchema !== APP_SCHEMA) {
    throw new Error(`DATABASE_URL targets schema '${existingSchema}', expected '${APP_SCHEMA}'.`);
  }

  parsed.searchParams.set("schema", APP_SCHEMA);
  return parsed.toString();
}

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("Usage: node scripts/with-english-portal-database-url.mjs <command> [...args]");
  process.exit(1);
}

function resolveCommand(commandName) {
  if (process.platform !== "win32") return { command: commandName, shell: false };
  if (commandName === "prisma" || commandName === "tsx" || commandName === "npm") {
    return {
      command: process.env.ComSpec || "cmd.exe",
      argsPrefix: ["/d", "/s", "/c", `${commandName}.cmd`],
      shell: false
    };
  }

  return { command: commandName, shell: false };
}

function childEnv(databaseUrl) {
  return Object.fromEntries(
    Object.entries({ ...process.env, DATABASE_URL: databaseUrl })
      .filter(([key, value]) => key && !key.startsWith("=") && value !== undefined)
  );
}

const databaseUrl = withAppSchema(process.env.DATABASE_URL);
const resolved = resolveCommand(command);
const child = spawn(resolved.command, [...(resolved.argsPrefix ?? []), ...args], {
  env: childEnv(databaseUrl),
  stdio: "inherit",
  shell: resolved.shell
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
