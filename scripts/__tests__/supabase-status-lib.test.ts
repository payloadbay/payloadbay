import { describe, expect, it, vi } from "vitest";

import { main } from "../supabase-status-lib";

const status = {
  API_URL: "http://127.0.0.1:54321",
  DB_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  FUNCTIONS_URL: "http://127.0.0.1:54321/functions/v1",
  REST_URL: "http://127.0.0.1:54321/rest/v1",
  STUDIO_URL: "http://127.0.0.1:54323",
  SECRET_KEY: "not-displayed",
};

function readableBody(value: string): ReadableStream<Uint8Array> {
  const body = new Response(value).body;
  if (!body) {
    throw new Error("Expected response body");
  }

  return body;
}

describe("main", () => {
  it("prints the selected URLs when Supabase status succeeds", async () => {
    const log = vi.fn();
    const exit = vi.fn();
    const spawn = vi.fn(() => ({
      exited: Promise.resolve(0),
      stdout: readableBody(JSON.stringify(status)),
    }));

    await main({ exit, log, spawn });

    expect(spawn).toHaveBeenCalledOnce();
    expect(exit).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      JSON.stringify(
        {
          DB_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
          API_URL: "http://127.0.0.1:54321",
          REST_URL: "http://127.0.0.1:54321/rest/v1",
          FUNCTIONS_URL: "http://127.0.0.1:54321/functions/v1",
          STUDIO_URL: "http://127.0.0.1:54323",
        },
        null,
        2,
      ),
    );
  });

  it("exits without reading JSON when Supabase status fails", async () => {
    const log = vi.fn();
    const exit = vi.fn();
    const spawn = vi.fn(() => ({
      exited: Promise.resolve(1),
      stdout: readableBody("not-json"),
    }));

    await main({ exit, log, spawn });

    expect(exit).toHaveBeenCalledWith(1);
    expect(log).not.toHaveBeenCalled();
  });
});
