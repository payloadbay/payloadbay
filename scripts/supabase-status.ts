const command = Bun.spawn(["bunx", "supabase", "status", "--output", "json"], {
  stdout: "pipe",
  stderr: "inherit",
});

const output = await new Response(command.stdout).text();
const exitCode = await command.exited;

if (exitCode !== 0) {
  Bun.exit(exitCode);
}

const status = JSON.parse(output) as Record<string, string>;

console.log(
  JSON.stringify(
    {
      DB_URL: status.DB_URL,
      API_URL: status.API_URL,
      REST_URL: status.REST_URL,
      FUNCTIONS_URL: status.FUNCTIONS_URL,
      STUDIO_URL: status.STUDIO_URL,
    },
    null,
    2,
  ),
);
