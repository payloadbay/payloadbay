import type { NextConfig } from "next";

const testCoverage = process.env.PAB_TEST_SOURCE_COVERAGE === "true";
const nextConfig: NextConfig = {
	output: "standalone",
	productionBrowserSourceMaps: testCoverage,
	experimental: { serverSourceMaps: testCoverage },
	webpack(config) {
		// Minification can inline imported bodies across source boundaries, leaving
		// executed handlers without a remappable V8 function range. Coverage builds
		// retain those boundaries; ordinary release builds keep Next's defaults.
		if (testCoverage) config.optimization.minimize = false;

		return config;
	},
};

export default nextConfig;
