type LocalServiceUrls = {
  API_URL: string;
  DB_URL: string;
  FUNCTIONS_URL: string;
  REST_URL: string;
  STUDIO_URL: string;
};

type LocalSupabaseStatus = LocalServiceUrls & Record<string, string>;

export type ProcessLike = {
  exited: Promise<number>;
  stdout: ReadableStream<Uint8Array>;
};

export type StatusDependencies = {
  exit: (code: number) => void;
  log: (message: string) => void;
  spawn: () => ProcessLike;
};

function formatLocalServiceUrls(status: LocalSupabaseStatus): LocalServiceUrls {
  return {
    DB_URL: status.DB_URL,
    API_URL: status.API_URL,
    REST_URL: status.REST_URL,
    FUNCTIONS_URL: status.FUNCTIONS_URL,
    STUDIO_URL: status.STUDIO_URL,
  };
}

export async function main(dependencies: StatusDependencies): Promise<void> {
  const command = dependencies.spawn();

  const output = await new Response(command.stdout).text();
  const exitCode = await command.exited;

  if (exitCode !== 0) {
    dependencies.exit(exitCode);
    return;
  }

  const status = JSON.parse(output) as LocalSupabaseStatus;
  dependencies.log(JSON.stringify(formatLocalServiceUrls(status), null, 2));
}
