"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, TextField, Label, Input, Chip, Card } from "@heroui/react";
import { NativeSelect } from "@heroui-pro/react";
import { useDashboard } from "@components/dashboard-shell";
import { CodeEditor } from "@components/code-editor";
import { HelperImportPicker } from "@components/helper-import-picker";
import { SecretBindings } from "@components/secret-bindings";
import { LoadingState } from "@components/loading-state";
import { useUnsavedChanges } from "@components/unsaved-changes";
import { api } from "@lib/api-client";
import { useFeedbackToast } from "@lib/feedback";
import { formatScript } from "@lib/script-document";
import { builtinEmailSource, webhookChannelSource } from "@contracts/notification-templates";
import { emailBranding } from "@contracts/notification-channels";
import type { ChannelSummary } from "@domain/notification-channels";

type Channel = ChannelSummary & {
	source: string;
	selectedRevisionId: string | null;
	sharedBindings: Record<string, string>;
	secretBindings: Record<string, string>;
	revisions: { id: string; version: number; createdAt: string }[];
};

type Preview = { decision: { kind: string }; logs: { level: string; message: string }[]; email: { html: string; text: string } | null };

export default function NotificationModulePage({ params }: { params: Promise<{ channelId: string }> }) {
	const { channelId } = use(params);

	const query = useSearchParams();
	const router = useRouter();
	const { me } = useDashboard();

	const [channel, setChannel] = useState<Channel | null>(null);

	const initialName = channelId === "new" ? (query.get("name") ?? "") : "";
	const initialSource = channelId === "new" ? (query.get("kind") === "webhook" ? webhookChannelSource : builtinEmailSource) : "";

	const [name, setName] = useState(initialName);
	const [source, setSource] = useState(initialSource);
	const [sharedBindings, setSharedBindings] = useState<Record<string, string>>({});
	const [secretBindings, setSecretBindings] = useState<Record<string, string>>({});
	const [baseline, setBaseline] = useState(
		JSON.stringify({
			name: initialName,
			source: initialSource,
			sharedBindings: {},
			secretBindings: {},
		}),
	);
	const [busy, setBusy] = useState(false);
	const [loading, setLoading] = useState(channelId !== "new");
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [preview, setPreview] = useState<Preview | null>(null);
	const [forking, setForking] = useState(false);

	const kind = channel?.kind ?? (query.get("kind") === "webhook" ? "webhook" : "email");
	const scope = { type: "instance" as const, id: me.instanceId };
	const dirty =
		baseline !==
		JSON.stringify({
			name,
			source,
			sharedBindings,
			secretBindings,
		});
	const readOnly = channel?.builtin && !forking;
	const canPublish = me.permissions.includes("code.publish") && me.permissions.includes("code.edit");

	useUnsavedChanges(!loading && dirty);

	useFeedbackToast(error, notice);

	const receive = useCallback((data: Channel) => {
		setChannel(data);
		setName(data.name);
		setSource(data.source);
		setSharedBindings(data.sharedBindings);
		setSecretBindings(data.secretBindings);
		setBaseline(
			JSON.stringify({
				name: data.name,
				source: data.source,
				sharedBindings: data.sharedBindings,
				secretBindings: data.secretBindings,
			}),
		);
	}, []);

	useEffect(() => {
		let active = true;
		if (channelId === "new") return;
		api<Channel>("/notification-channels/" + channelId)
			.then(
				(data) => {
					if (active) receive(data);
				},
				(cause) => {
					if (active) setError(cause.message);
				},
			)
			.finally(() => {
				if (active) setLoading(false);
			});

		return () => {
			active = false;
		};
	}, [channelId, receive]);

	async function act(task: () => Promise<void>) {
		setBusy(true);
		setError("");
		setNotice("");
		try {
			await task();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Module operation failed");
		} finally {
			setBusy(false);
		}
	}

	async function publish() {
		await act(async () => {
			const formatted = await formatScript(source);
			const saved = await api<ChannelSummary>("/notification-channels", {
				method: "POST",
				json: {
					...(channel && !forking ? { id: channel.id, expectedVersion: channel.version } : {}),
					name,
					kind,
					source: formatted,
					sharedBindings,
					secretBindings,
					...(forking && channel ? { originKey: channel.id } : {}),
				},
			});
			setSource(formatted);
			setBaseline(
				JSON.stringify({
					name,
					source: formatted,
					sharedBindings,
					secretBindings,
				}),
			);
			setForking(false);
			receive(await api<Channel>("/notification-channels/" + saved.id));
			if (channelId !== saved.id) router.replace("/admin/notification-channels/" + saved.id);
			setNotice("Published v" + saved.activeVersion + ". Queued messages keep their pinned version.");
		});
	}

	if (loading) return <LoadingState label='Loading notification module…' />;
	if (error && !source)
		return (
			<div>
				<h1 className='text-xl'>Module unavailable</h1>
				<Link href='/admin/notification-channels'>Back to modules</Link>
			</div>
		);

	return (
		<section className='flex min-w-0 flex-col gap-6'>
			<header>
				<Link className='text-accent' href='/admin/notification-channels'>
					Notification modules
				</Link>
				<h1 className='mt-2 text-3xl font-semibold'>{channelId === "new" ? "Create notification module" : name}</h1>
				<p className='text-muted mt-2'>Instance-owned code. Email modules return ctx.email(message); HTTP modules use fetch and return ctx.complete(), ctx.retry(), or ctx.fail(). Recipients and SMTP credentials are controlled by the platform.</p>
			</header>
			<div className='flex flex-wrap items-center gap-3'>
				{channel?.builtin && <Chip>{forking ? "Fork draft" : "Shipped · read-only"}</Chip>}
				{channel && canPublish && !forking && (
					<Button
						variant='secondary'
						onPress={() => {
							setForking(true);
							setName(channel.name + " copy");
						}}
					>
						Fork module
					</Button>
				)}
				{channel && !channel.builtin && !forking && (
					<Button
						variant='secondary'
						isDisabled={busy}
						onPress={() =>
							void act(async () => {
								await api("/notification-channels/" + channel.id, { method: "PATCH", json: { expectedVersion: channel.version, enabled: !channel.enabled } });
								receive(await api("/notification-channels/" + channel.id));
							})
						}
					>
						{channel.enabled ? "Pause module" : "Enable module"}
					</Button>
				)}
			</div>
			<TextField value={name} onChange={setName} isReadOnly={Boolean(readOnly)} maxLength={100}>
				<Label>Module name</Label>
				<Input variant='secondary' />
			</TextField>
			{channel && !channel.builtin && !forking && (
				<NativeSelect variant='secondary'>
					<Label>Version</Label>
					<NativeSelect.Trigger aria-label='Module version' value={channel.selectedRevisionId ?? ""} disabled={busy || dirty} onChange={(event) => void act(async () => receive(await api("/notification-channels/" + channel.id + "?revisionId=" + event.target.value)))}>
						{channel.revisions.map((revision, index) => (
							<NativeSelect.Option key={revision.id} value={revision.id}>
								v{revision.version}
								{revision.id === channel.activeRevisionId ? " · Active" : ""}
								{index === 0 ? " · Latest" : ""}
							</NativeSelect.Option>
						))}
						<NativeSelect.Indicator />
					</NativeSelect.Trigger>
				</NativeSelect>
			)}
			{channel && !channel.builtin && channel.selectedRevisionId !== channel.activeRevisionId && !forking && canPublish && (
				<Button
					variant='secondary'
					isDisabled={busy || dirty}
					onPress={() =>
						void act(async () => {
							await api("/notification-channels/" + channel.id, { method: "PATCH", json: { expectedVersion: channel.version, activeRevisionId: channel.selectedRevisionId } });
							receive(await api("/notification-channels/" + channel.id));
						})
					}
				>
					Use selected version
				</Button>
			)}
			<div className='flex flex-wrap items-center justify-between gap-3'>
				<h2 className='text-xl font-semibold'>Script</h2>
				<HelperImportPicker
					scope={scope}
					body={source}
					disabled={Boolean(readOnly) || busy || !canPublish}
					onImport={(body, alias, revisionId) => {
						setSource(body);
						setSharedBindings((bindings) => ({ ...bindings, [alias]: revisionId }));
					}}
				/>
			</div>
			<CodeEditor
				label='Notification module source'
				value={source}
				onChange={setSource}
				readOnly={Boolean(readOnly) || !canPublish}
				helperScope={scope}
				onSave={() => {
					if (!readOnly && canPublish) void publish();
				}}
			/>
			{!readOnly && <SecretBindings scope={scope} bindings={secretBindings} onChange={setSecretBindings} canUse={me.permissions.includes("secrets.use")} canManage={me.permissions.includes("secrets.manage")} disabled={busy || !canPublish} />}
			<div className='flex flex-wrap justify-center gap-3 sm:justify-start'>
				{!readOnly && canPublish && (
					<Button isDisabled={busy || !name.trim()} onPress={() => void publish()}>
						Publish version
					</Button>
				)}
				<Button
					variant='secondary'
					isDisabled={busy || !me.permissions.includes("code.test")}
					onPress={() =>
						void act(async () =>
							setPreview(
								await api("/notification-channels/preview", {
									method: "POST",
									json: {
										name,
										kind,
										source,
										sharedBindings,
										secretBindings,
										branding: emailBranding.parse({}),
									},
								}),
							),
						)
					}
				>
					Test without external effects
				</Button>
				{channel && !forking && (
					<Button
						variant='secondary'
						isDisabled={busy || dirty || !me.permissions.includes("code.test.effects")}
						onPress={() =>
							void act(async () => {
								const queued = await api<{ recipient: string }>("/notification-channels/" + channel.id + "/test", { method: "POST" });
								setNotice("Queued a real test for " + queued.recipient + ". HTTP modules may contact their configured endpoint.");
							})
						}
					>
						Send published test
					</Button>
				)}
			</div>
			<p className='text-muted text-sm'>Dry tests use synthetic content and secrets and block fetch. A published test performs real delivery. Scripts run in the configured workerd executor; ordinary Docker is not a hardened host sandbox.</p>
			{preview && (
				<Card>
					<Card.Header>
						<Card.Title>Test result: {preview.decision.kind}</Card.Title>
					</Card.Header>
					<Card.Content className='flex flex-col gap-4'>
						{preview.email && <iframe title='Notification email preview' sandbox='' className='h-[560px] w-full rounded-lg border border-border' srcDoc={"<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'; img-src https: http: data:;\">" + preview.email.html} />}
						<pre className='max-h-64 overflow-auto whitespace-pre-wrap text-sm'>{preview.logs.length ? preview.logs.map((log) => log.level + ": " + log.message).join("\n") : "No script logs."}</pre>
					</Card.Content>
				</Card>
			)}
		</section>
	);
}
