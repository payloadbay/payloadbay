import { main } from "./supabase-status-lib";

const command = Bun.spawn({
  cmd: ["bunx", "supabase", "status", "--output", "json"],
  stderr: "inherit",
  stdout: "pipe",
});

if (!(command.stdout instanceof ReadableStream)) {
  throw new Error("Supabase status command did not provide a readable stdout");
}

await main({
  exit: process.exit,
  log: console.log,
  spawn: () => command,
});
