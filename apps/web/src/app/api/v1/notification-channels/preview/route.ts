import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { notificationChannelPreview } from "@contracts/notification-channels";
import { notificationDecision } from "@contracts/lifecycle";
import { notificationInstance } from "@domain/notification-channels";
import { requirePermission } from "@domain/membership";
import { pinSourceImports, resolveSharedModules } from "@domain/shared-code";
import { compileSource, executeSource } from "@domain/executor-client";
import { sampleNotification } from "@domain/notification-testing";
import { renderEmailMessage } from "@domain/email-renderer";

export async function POST(request: Request) {
	return protectedRoute(request, async ({ pool, config }, actor) => {
		const scope = await notificationInstance(pool);
		await requirePermission(pool, actor, scope, "settings.manage");
		await requirePermission(pool, actor, scope, "code.test");
		const data = await readJson(request, notificationChannelPreview);
		const sharedBindings = await pinSourceImports(pool, actor, scope, data.source, data.sharedBindings);
		const sharedModules = await resolveSharedModules(pool, actor, scope, sharedBindings);
		const compiled = await compileSource(config, {
			stage: "notification",
			body: data.source,
			sourceId: "notification-channel",
			sharedModules,
		});
		const result = await executeSource(config, {
			stage: "notification",
			bundle: compiled.bundle,
			input: {
				deliveryId: crypto.randomUUID(),
				attempt: 1,
				kind: "channel.test",
				message: sampleNotification("alert", config.publicUrl),
				recipient: { email: "reviewer@example.test" },
				secrets: Object.fromEntries(Object.keys(data.secretBindings).map((name) => [name, "https://example.test/synthetic-secret"])),
			},
			dryRun: true,
			deadlineMs: 5000,
			maxFetches: 0,
		});
		const decision = notificationDecision.parse(result.decision);

		return { decision, logs: result.logs, email: decision.kind === "email" ? await renderEmailMessage(decision.message, data.branding) : null };
	});
}
