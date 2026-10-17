import type { NextConfig } from "next";

const testCoverage = process.env.PAB_TEST_SOURCE_COVERAGE === "true";
const nextConfig: NextConfig = {
	output: "standalone",
	productionBrowserSourceMaps: testCoverage,
	experimental: { serverSourceMaps: testCoverage },
};

export default nextConfig;
