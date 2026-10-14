import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { after } from "node:test";

type Fixture = {
	databaseUrl: string;
	smtpPort: number;
	mailUrl: string;
	httpUrl: string;
	network: string;
	containerDatabaseUrl: string;
};

const project = "pab-test-" + randomUUID().slice(0, 8);

const docker = (args: string[]) => execFileSync("docker", ["compose", "-f", "deploy/compose.dev.yml", "-p", project, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

let infrastructure: Promise<Fixture> | undefined;
let serial: Promise<unknown> = Promise.resolve();

async function start() {
	docker(["up", "--build", "-d", "--wait", "--wait-timeout", "60", "postgres", "smtp", "http"]);

	const port = (service: string, containerPort: number) =>
		Number(
			docker(["port", service, String(containerPort)])
				.trim()
				.split(":")
				.at(-1),
		);

	const fixture = {
		network: project + "_default",
		containerDatabaseUrl: "postgres://fixture:fixture-only@postgres:5432/fixture",
		databaseUrl: `postgres://fixture:fixture-only@127.0.0.1:${port("postgres", 5432)}/fixture`,
		smtpPort: port("smtp", 1025),
		mailUrl: `http://127.0.0.1:${port("smtp", 8025)}`,
		httpUrl: `http://127.0.0.1:${port("http", 8080)}`,
	};
	for (let i = 0; i < 50; i++) {
		try {
			await fetch(fixture.httpUrl + "/health");
			break;
		} catch {
			if (i === 49) throw Error("HTTP fixture unavailable");
			await new Promise((r) => setTimeout(r, 100));
		}
	}

	return fixture;
}

export async function stopFixtures() {
	if (infrastructure) {
		await serial.catch(() => {});
		docker(["down", "--volumes", "--remove-orphans", "--timeout", "5"]);
		infrastructure = undefined;
	}
}

after(stopFixtures);

export async function withFixtures<T>(run: (fixture: Fixture) => Promise<T>): Promise<T> {
	let release!: () => void;
	const previous = serial;
	serial = new Promise<void>((resolve) => (release = resolve));
	await previous;
	let admin: Client | undefined;
	const database = "case_" + randomUUID().replaceAll("-", "");
	try {
		const shared = await (infrastructure ??= start());
		admin = new Client({ connectionString: shared.databaseUrl });
		await admin.connect();
		await admin.query(`CREATE DATABASE "${database}"`);
		const reset = await fetch(shared.httpUrl + "/reset", { method: "POST" });
		if (!reset.ok) throw Error("HTTP fixture reset failed");
		const cleared = await fetch(shared.mailUrl + "/api/v1/messages", { method: "DELETE" });
		if (!cleared.ok) throw Error("SMTP fixture reset failed");
		const url = new URL(shared.databaseUrl);
		url.pathname = "/" + database;
		const internal = new URL(shared.containerDatabaseUrl);
		internal.pathname = "/" + database;

		return await run({ ...shared, databaseUrl: url.toString(), containerDatabaseUrl: internal.toString() });
	} finally {
		try {
			if (admin) {
				try {
					await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
				} finally {
					await admin.end();
				}
			}
		} finally {
			release();
		}
	}
}
