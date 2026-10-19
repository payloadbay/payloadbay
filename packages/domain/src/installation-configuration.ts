import type { OAuthProvider } from "../../contracts/src/oauth.ts";
import type { Pool } from "pg";
import type { ServerConfig } from "./config.ts";
import type { Actor } from "./authorization.ts";
import { editableInstallationSettings, installationUpdateInput, installationPolicySettings } from "../../contracts/src/installation.ts";
import { AppError } from "../../contracts/src/errors.ts";
import { encryptPrivate, decryptPrivate } from "./private-crypto.ts";
import { requirePermission } from "./membership.ts";
import { transaction } from "./db.ts";

/** Saved application policy is authoritative; SMTP and infrastructure stay deployment-owned. */
export async function resolveInstallationConfiguration(pool: Pool, base: ServerConfig) {
	const row = (await pool.query("SELECT version,encrypted_settings FROM payloadbay.installation_configuration LIMIT 1")).rows[0];
	if (!row) return { config: { ...base, ...installationPolicySettings.parse({}), oauth: {} }, version: 0 };
	const saved = editableInstallationSettings.parse(decryptPrivate<unknown>(row.encrypted_settings, base.encryptionKey));
	const config = { ...base, ...saved };

	return { config, version: Number(row.version) };
}

function selectedSettings(config: ServerConfig) {
	return editableInstallationSettings.parse({ ...installationPolicySettings.parse(Object.fromEntries(Object.keys(installationPolicySettings.shape).map((key) => [key, config[key as keyof ServerConfig]]))), oauth: config.oauth });
}

export async function editableConfiguration(pool: Pool, actor: Actor, installationId: string, base: ServerConfig) {
	await requirePermission(pool, actor, { type: "instance", id: installationId }, "settings.manage");
	const { config, version } = await resolveInstallationConfiguration(pool, base);
	const settings = selectedSettings(config);
	const oauth = Object.fromEntries(
		Object.entries(settings.oauth).map(([name, value]) => {
			const { clientSecret, ...client } = value;

			return [name, { ...client, secretConfigured: Boolean(clientSecret) }];
		}),
	);

	return { version, settings: { ...settings, oauth }, locked: [] as string[] };
}

export async function saveInstallationConfiguration(pool: Pool, actor: Actor, installationId: string, base: ServerConfig, input: unknown) {
	const data = installationUpdateInput.safeParse(input);
	if (!data.success) throw new AppError("invalid_input", 400, "Provide valid installation settings");
	await transaction(pool, async (db) => {
		await requirePermission(db, actor, { type: "instance", id: installationId }, "settings.manage");
		await db.query("SELECT id FROM payloadbay.installation WHERE id=$1 FOR UPDATE", [installationId]);
		const row = (await db.query("SELECT version,encrypted_settings FROM payloadbay.installation_configuration WHERE installation_id=$1", [installationId])).rows[0];
		if (Number(row?.version ?? 0) !== data.data.version) throw new AppError("version_conflict", 409, "Installation settings changed; reload before saving");
		const old = row ? editableInstallationSettings.parse(decryptPrivate<unknown>(row.encrypted_settings, base.encryptionKey)) : selectedSettings({ ...base, oauth: {} });
		const next = editableInstallationSettings.parse({ ...old, ...data.data.settings });
		for (const [name, value] of Object.entries(next.oauth)) {
			const previous = old.oauth[name as OAuthProvider];
			if (!value.clientSecret && value.clientId === previous?.clientId) value.clientSecret = previous?.clientSecret;
			if (!value.clientSecret) throw new AppError("invalid_input", 400, "A new OAuth application requires its client secret");
		}

		await db.query("INSERT INTO payloadbay.installation_configuration(installation_id,version,encrypted_settings) VALUES($1,1,$2) ON CONFLICT(installation_id) DO UPDATE SET version=payloadbay.installation_configuration.version+1,encrypted_settings=EXCLUDED.encrypted_settings,updated_at=clock_timestamp()", [installationId, encryptPrivate(next, base.encryptionKey)]);
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id,redacted_diff) VALUES($1,'instance',$2::uuid,'installation.settings_updated',($2::uuid)::text,$3)", [actor.userId, installationId, JSON.stringify({ version: data.data.version + 1, resourceName: "Installation settings", fields: Object.keys(data.data.settings) })]);
	});

	return editableConfiguration(pool, actor, installationId, base);
}
