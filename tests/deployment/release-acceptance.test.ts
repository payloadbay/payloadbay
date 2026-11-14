import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const runner = await import(new URL("../../scripts/release/accept.mjs", import.meta.url).href);
const sha = "a".repeat(40);
const coordinates = ["SOURCE_SHA=" + sha, ...["app", "worker", "executor", "migrator"].map((service) => `PAYLOADBAY_${service.toUpperCase()}_IMAGE=ghcr.io/payloadbay/payloadbay-${service}@sha256:${"b".repeat(64)}`)].join("\n");

test("release acceptance refuses mutable, missing, duplicate and foreign image coordinates", () => {
	assert.equal(runner.candidateCoordinates(coordinates).SOURCE_SHA, sha);
	for (const input of [coordinates.replace(sha, "master"), coordinates.replace(/@sha256:b+/g, ":latest"), coordinates.replace("payloadbay/payloadbay-app", "another/foreign-app"), coordinates + "\nSOURCE_SHA=" + sha, coordinates.split("\n").slice(0, -1).join("\n"), coordinates + "\nPOSTGRES_PASSWORD=operator-secret", coordinates + "\nmalformed"]) {
		assert.throws(() => runner.candidateCoordinates(input));
	}
});

test("release acceptance coordinate validation cannot claim an installation certificate", async () => {
	const directory = await mkdtemp(join(tmpdir(), "pab-accept-policy-"));
	try {
		await writeFile(join(directory, "images.env"), coordinates);
		assert.deepEqual(await runner.accept(directory, { validateOnly: true }), { status: "coordinates-valid-not-installation-certified", sourceSha: sha });
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("release acceptance rejects root image users even with a custom group", () => {
	const image = (user: string, revision = sha) => ({ Config: { User: user, Labels: { "org.opencontainers.image.revision": revision } } });

	for (const user of ["node", "1000", "node:node", "1000:1000"]) runner.validateCandidateImage(image(user), sha);
	for (const user of ["", "root", "0", "0:0", "0:1000", "00:1000", "root:node", ":1000"]) assert.throws(() => runner.validateCandidateImage(image(user), sha));
	assert.throws(() => runner.validateCandidateImage(image("node", "b".repeat(40)), sha));
});
