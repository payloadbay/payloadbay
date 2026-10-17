import type { Actor } from "./authorization.ts";

export type Principal = Actor & { active: boolean; transport: "cookie" | "token" };

export type RequestContextOptions = { origin: string; authenticate: (request: Request) => Promise<Principal | null> };
