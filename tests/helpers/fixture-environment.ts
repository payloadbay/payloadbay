import { setupSecret } from "./auth-fixtures.ts";

export function fixtureEnvironment(
	f: {
		databaseUrl: string;
		smtpPort: number;
		mailUrl?: string;
		httpUrl?: string;
	},
	publicUrl: string,
): NodeJS.ProcessEnv {
	const env: NodeJS.ProcessEnv = {};
	for (const key of ["PATH", "HOME", "TMPDIR", "TMP", "TEMP", "SystemRoot", "USERPROFILE", "LOCALAPPDATA", "APPDATA", "LANG", "LC_ALL", "NO_COLOR", "FORCE_COLOR", "TZ", "PAB_TEST_PORT", "PAB_TEST_ARTIFACT_DIR", "PAB_TEST_RUN_ID", "PAB_TEST_SOURCE_COVERAGE"]) if (process.env[key] !== undefined) env[key] = process.env[key];

	return {
		...env,
		NEXT_TELEMETRY_DISABLED: "1",
		DATABASE_URL: f.databaseUrl,
		PUBLIC_URL: publicUrl,
		SMTP_HOST: "127.0.0.1",
		SMTP_PORT: String(f.smtpPort),
		SMTP_FROM: "fixture@example.test",
		SMTP_SECURE: "false",
		BETTER_AUTH_SECRET: "fixture-auth-secret-32-characters",
		PAYLOADBAY_ENCRYPTION_KEY: "fixture-encryption-key-32-characters",
		PAYLOADBAY_BOOTSTRAP_SECRET: setupSecret,
		PAYLOADBAY_EXECUTOR_TOKEN: "fixture-executor-token-32-characters",
		PAYLOADBAY_BROKER_SECRET: "fixture-broker-secret-32-characters",
		PAB_TEST_MAIL_URL: f.mailUrl,
		PAB_TEST_HTTP_URL: f.httpUrl,
	};
}
