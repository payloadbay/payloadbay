import { build } from "esbuild";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { watch } from "node:fs";
import { readFile, writeFile, mkdir, cp, mkdtemp, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { tmpdir } from "node:os";
import tailwind from "@tailwindcss/postcss";
import { componentGroups, componentName } from "./catalog-items.ts";

const require = createRequire(import.meta.resolve("@tailwindcss/postcss"));
const postcss = require("postcss");
const source = fileURLToPath(new URL(".", import.meta.url));
const components = path.join(source, "../src/app/components/ui");
const output = "/tmp/payloadbay-design-review";
let revision = 0;
let buildError = "";
let building = false;
let pending = false;
await mkdir(output, { recursive: true });

async function rebuild() {
	if (building) {
		pending = true;

		return;
	}

	building = true;
	const staging = await mkdtemp(path.join(tmpdir(), "payloadbay-review-build-"));
	try {
		const result = await build({
			entryPoints: ["pro", "replacement", "catalog", "catalog-pro"].map((side) => path.join(source, `${side}.tsx`)),
			bundle: true,
			outdir: staging,
			jsx: "automatic",
			tsconfig: path.join(source, "../tsconfig.json"),
			format: "esm",
			splitting: true,
			chunkNames: "chunks/[name]-[hash]",
			minify: true,
			define: { "process.env.NODE_ENV": '"production"' },
			metafile: true,
		});
		for (const entry of ["replacement.tsx", "catalog.tsx"]) {
			const key = Object.keys(result.metafile.inputs).find((name) => path.resolve(name) === path.join(source, entry));
			const visited = new Set();

			function visit(name) {
				if (visited.has(name)) return;
				visited.add(name);
				if (name.includes("@heroui-pro") || name.includes("/heroui-pro/")) throw new Error(`Independent ${entry} includes Pro code`);
				for (const item of result.metafile.inputs[name]?.imports ?? []) if (!item.external) visit(item.path);
			}

			if (!key) throw new Error(`Missing independent entry ${entry}`);
			visit(key);
		}

		const reload = '<script>let version;setInterval(async()=>{try{const state=await(await fetch(new URL("__revision",location.href),{cache:"no-store"})).json();if(version===undefined)version=state.revision;else if(version!==state.revision)location.reload();}catch{}},1200);</script>';
		for (const side of ["pro", "replacement", "catalog", "catalog-pro"]) {
			const licensed = side === "pro" || side === "catalog-pro";
			const css = `@import "tailwindcss"; @import "@heroui/styles"; ${licensed ? '@import "@heroui-pro/react/css";' : ""} @import "../src/app/styles/brand-theme.css"; @import "@fontsource-variable/inter"; @source "./*.tsx"; @source "../src/app/components/ui/*.tsx"; @theme inline { --font-sans: "Inter Variable", Inter, sans-serif; } body { margin:0; background:var(--background); color:var(--foreground); font-family:var(--font-sans); }`;
			const styled = await postcss([tailwind({ base: source })]).process(css, { from: path.join(source, `${side}.css`) });
			const withFonts = styled.css.replace(/url\(([^)]*inter-[^/)]*\.woff2)\)/g, (_, url) => `url(./files/${path.basename(url.replace(/["']/g, ""))})`);
			await writeFile(path.join(staging, `${side}.css`), withFonts);
			const independentCss = (await readFile(path.join(components, "primitives.css"), "utf8")) + "\n" + (await readFile(path.join(components, "catalog.css"), "utf8"));
			await writeFile(path.join(staging, `${side}-composition.css`), licensed ? await readFile(path.join(source, "pro-review.css"), "utf8") : independentCss + (side === "replacement" ? "\n" + (await readFile(path.join(source, "replacement.css"), "utf8")) : ""));
			await writeFile(path.join(staging, `${side}.html`), `<!doctype html><html lang="en" data-theme="dark"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${side} comparison</title><link rel="stylesheet" href="./${side}.css"><link rel="stylesheet" href="./${side}-composition.css"><div id="root"></div><script type="module" src="./${side}.js"></script>${reload}</html>`);
		}

		let index = await readFile(path.join(source, "index.html"), "utf8");
		const options = Object.entries(componentGroups)
			.map(([group, ids]) => `<optgroup label="${group}">${ids.map((id) => `<option value="${id}">${componentName(id)}</option>`).join("")}</optgroup>`)
			.join("");
		index = index.replace("<!-- catalog-options -->", options);
		await writeFile(path.join(staging, "index.html"), index);
		await cp(staging, output, { recursive: true });
		revision += 1;
		buildError = "";
		console.log(`Design review revision ${revision}: http://localhost:4173`);
	} catch (error) {
		buildError = error instanceof Error ? error.message : String(error);
		console.error(buildError);
	} finally {
		await rm(staging, { recursive: true, force: true });
		building = false;
		if (pending) {
			pending = false;
			await rebuild();
		}
	}
}

await rebuild();
if (process.env.REVIEW_BUILD_ONLY === "1") process.exit(buildError ? 1 : 0);
const types = {
	".html": "text/html",
	".js": "text/javascript",
	".css": "text/css",
	".woff2": "font/woff2",
};
createServer(async (request, response) => {
	try {
		const pathname = new URL(request.url, "http://localhost").pathname;
		response.setHeader("Cache-Control", "no-store");
		if (pathname.endsWith("/__revision")) {
			response.setHeader("Content-Type", "application/json");
			response.end(JSON.stringify({ revision, error: buildError }));

			return;
		}

		const basename = path.basename(pathname);
		const filename = pathname.includes("files/") ? path.join(source, "../node_modules/@fontsource-variable/inter/files", basename) : pathname.includes("/chunks/") ? path.join(output, "chunks", basename) : path.join(output, pathname.endsWith("/") ? "index.html" : basename);
		response.setHeader("Content-Type", types[path.extname(filename)] ?? "application/octet-stream");
		response.end(await readFile(filename));
	} catch {
		response.writeHead(404);
		response.end("Not found");
	}
}).listen(4173, "::");
let timer;
for (const directory of [source, components])
	watch(directory, { recursive: true }, (_, filename) => {
		if (!filename || !/\.(tsx?|css|html)$/.test(String(filename))) return;
		clearTimeout(timer);
		timer = setTimeout(rebuild, 250);
	});
