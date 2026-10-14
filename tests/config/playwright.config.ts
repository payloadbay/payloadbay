import { defineConfig } from "@playwright/test";

const port = process.env.PAB_TEST_PORT ?? "43179";
const artifact = process.env.PAB_TEST_ARTIFACT_DIR ?? "test-results/browser";

export default defineConfig({
	outputDir: artifact + "/traces",
	testDir: "../acceptance",
	fullyParallel: false,
	workers: 1,
	retries: 0,
	reporter: [["list"], ["junit", { outputFile: artifact + "/junit.xml" }]],
	use: { baseURL: `http://127.0.0.1:${port}`, trace: "retain-on-failure" },
	webServer: {
		command: "bun run web:start",
		url: `http://127.0.0.1:${port}`,
		reuseExistingServer: false,
		env: { PORT: port, HOSTNAME: "127.0.0.1" },
		timeout: 60000,
	},
});
