import { cp, access } from "node:fs/promises";

const appRoot = new URL("../", import.meta.url);
const standaloneRoot = new URL(".next/standalone/apps/web/", appRoot);
await access(new URL("server.js", standaloneRoot));
await cp(new URL(".next/static/", appRoot), new URL(".next/static/", standaloneRoot), { recursive: true });
try {
	await access(new URL("public/", appRoot));
	await cp(new URL("public/", appRoot), new URL("public/", standaloneRoot), { recursive: true });
} catch (error) {
	if (error.code !== "ENOENT") throw error;
}
