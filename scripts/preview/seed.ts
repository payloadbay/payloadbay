import { database } from "../../packages/domain/src/db.ts";
import { readServerConfig } from "../../packages/domain/src/config.ts";
import { createAuth } from "../../packages/domain/src/auth-runtime.ts";
import { seedPreviewDemo } from "../../packages/domain/src/preview-demo.ts";

const config = readServerConfig(process.env);
const pool = database(config.databaseUrl);
const identity = createAuth(pool, config);
try {
	await seedPreviewDemo(pool, config, identity);
	console.log("Disposable preview demo is initialized; use reviewer@preview.payloadbay.test and the preview mail catcher for login.");
} finally {
	await identity.close();
	await pool.end();
}
