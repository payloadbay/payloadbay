import { createHash } from "node:crypto";
import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";
import type { Pool } from "pg";
import type { OAuthClient, OAuthProvider } from "../../contracts/src/oauth.ts";
import { transaction } from "./db.ts";

export function oauthAuthorityDigest(provider: OAuthProvider, client: OAuthClient) {
	return createHash("sha256")
		.update(JSON.stringify([provider, client.clientId, client.domain ?? "", client.region ?? "", client.userPoolId ?? "", client.tenantId?.toLowerCase() ?? (provider === "microsoft" ? "common" : ""), client.environment ?? (provider === "paypal" ? "live" : provider === "salesforce" ? "production" : "")]))
		.digest("hex");
}

export async function protectStoredOAuthTokens(pool: Pool, key: Parameters<typeof symmetricEncrypt>[0]["key"]) {
	await transaction(pool, async (db) => {
		const rows = (await db.query('SELECT id,"accessToken","refreshToken" FROM auth.account WHERE "accessToken" IS NOT NULL OR "refreshToken" IS NOT NULL OR "idToken" IS NOT NULL FOR UPDATE')).rows;
		for (const row of rows) {
			const tokens: (string | null)[] = [];
			for (const name of ["accessToken", "refreshToken"]) {
				const value = row[name] as string | null;
				if (!value) tokens.push(null);
				else if (value.startsWith("$ba$") || (value.length % 2 === 0 && /^[a-f0-9]+$/i.test(value))) {
					try {
						await symmetricDecrypt({ key, data: value });
						tokens.push(value);
					} catch {
						tokens.push(null);
					}
				} else tokens.push(await symmetricEncrypt({ key, data: value }));
			}

			await db.query('UPDATE auth.account SET "accessToken"=$2,"refreshToken"=$3,"idToken"=NULL WHERE id=$1', [row.id, ...tokens]);
		}
	});
}
