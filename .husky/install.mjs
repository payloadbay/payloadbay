import { existsSync } from "node:fs";

if (process.env.CI !== "true" && process.env.NODE_ENV !== "production" && existsSync(".git")) {
	const husky = (await import("husky")).default;
	const error = husky();
	if (error) throw Error(error);
}
