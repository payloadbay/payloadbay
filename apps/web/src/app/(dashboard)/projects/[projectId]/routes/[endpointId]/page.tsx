"use client";

import { useFeedbackToast } from "@lib/feedback";
import Link from "next/link";
import { use, useState, useEffect, useCallback } from "react";
import { Button, Card, Tabs, Accordion, TextArea, Label } from "@heroui/react";
import { IconArrowLeft, IconCheck, IconUpload, IconPlayerPause, IconPlayerPlay, IconCopy, IconChevronDown } from "@tabler/icons-react";
import { NativeSelect } from "@heroui-pro/react";
import { formatScript } from "@lib/script-document";
import { CodeEditor } from "@components/code-editor";
import { SharedBindings } from "@components/shared-bindings";
import { SecretBindings } from "@components/secret-bindings";
import { api, ApiFailure } from "@lib/api-client";
import { hmacTemplate } from "@sdk/templates/hmac";
import { unverifiedTemplate } from "@sdk/templates/unverified";
import { deliveryTemplate } from "@sdk/templates/delivery";
import type { CompilationDiagnostic } from "@contracts/compilation";
import type { Permission } from "@contracts/permissions";

type Stage = "ingress" | "processing";
type Draft = {
	body: string;
	version: number;
	shared_bindings: Record<string, string>;
	secret_bindings: Record<string, string>;
};
type Route = {
	paused: boolean;
	id: string;
	projectId: string;
	name: string;
	version: number;
	activePublicationId: string | null;
	permissions: Permission[];
	ingressUrl?: string;
};
type Publication = { id: string; created_at: string };

export default function RoutePage({ params }: { params: Promise<{ projectId: string; endpointId: string }> }) {
	const { projectId, endpointId } = use(params);

	const [route, setRoute] = useState<Route | null>(null);
	const [drafts, setDrafts] = useState<Record<Stage, Draft> | null>(null);
	const [savedDrafts, setSavedDrafts] = useState<Record<Stage, Draft> | null>(null);
	const [history, setHistory] = useState<Publication[]>([]);
	const [stage, setStage] = useState<Stage>("ingress");
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [diagnostics, setDiagnostics] = useState<CompilationDiagnostic[]>([]);

	useFeedbackToast(error, notice, { error: "Script configuration error", success: "Script status" });

	const [testBody, setTestBody] = useState("{}");
	const [testHeaders, setTestHeaders] = useState("{}");
	const [testSecrets, setTestSecrets] = useState("{}");
	const [testResult, setTestResult] = useState<unknown>(null);

	async function testSynthetic() {
		if (!drafts) return;
		setBusy(true);
		setNotice("");
		setError("");
		setNotice("");
		setDiagnostics([]);
		setTestResult(null);
		try {
			const result = await api<unknown>("/endpoints/" + endpointId + "/test", {
				method: "POST",
				json: {
					stage,
					body: drafts[stage].body,
					sharedBindings: drafts[stage].shared_bindings,
					fixture: {
						body: testBody,
						contentType: "application/json",
						headers: JSON.parse(testHeaders),
						secrets: JSON.parse(testSecrets),
					},
				},
			});
			setTestResult(result);
			setNotice("Synthetic test completed. External HTTP is blocked; managed sends simulate HTTP 204. No event was stored.");
		} catch (cause) {
			failed(cause);
		} finally {
			setBusy(false);
		}
	}

	const fetchData = useCallback(async () => {
		const next = await api<Route>("/endpoints/" + endpointId);
		if (next.projectId !== projectId) throw Error("Route does not belong to this project");
		const code = next.permissions.includes("code.read") ? await Promise.all([api<Draft>("/endpoints/" + endpointId + "/drafts/ingress"), api<Draft>("/endpoints/" + endpointId + "/drafts/processing"), api<Publication[]>("/endpoints/" + endpointId + "/publications")]) : null;

		return { next, code };
	}, [endpointId, projectId]);

	const receive = useCallback(({ next, code }: Awaited<ReturnType<typeof fetchData>>) => {
		setRoute(next);
		setDrafts(code ? { ingress: code[0], processing: code[1] } : null);
		setSavedDrafts(code ? { ingress: code[0], processing: code[1] } : null);
		setHistory(code?.[2] ?? []);
		setError("");
		setLoading(false);
	}, []);

	const loadFailed = useCallback((cause: unknown) => {
		setError(cause instanceof Error ? cause.message : "Route unavailable");
		setLoading(false);
	}, []);

	const load = useCallback(async () => {
		try {
			receive(await fetchData());
		} catch (cause) {
			loadFailed(cause);
		}
	}, [fetchData, receive, loadFailed]);

	useEffect(() => {
		let active = true;
		fetchData().then(
			(data) => {
				if (active) receive(data);
			},
			(cause) => {
				if (active) loadFailed(cause);
			},
		);

		return () => {
			active = false;
		};
	}, [fetchData, receive, loadFailed]);

	function failed(cause: unknown) {
		setError(cause instanceof Error ? cause.message : "Could not save configuration");
		setDiagnostics(cause instanceof ApiFailure ? (cause.diagnostics ?? []) : []);
	}

	async function change(body: string) {
		try {
			body = await formatScript(body, stage);
		} catch (cause) {
			failed(cause);

			return;
		}

		setDrafts((previous) => (previous ? { ...previous, [stage]: { ...previous[stage], body } } : previous));
		setNotice("");
	}

	async function save() {
		if (!drafts) return;
		setBusy(true);
		setNotice("");
		setError("");
		setDiagnostics([]);
		try {
			const formatted = await formatScript(drafts[stage].body, stage, drafts[stage].shared_bindings);
			const saved = await api<Draft>("/endpoints/" + endpointId + "/drafts/" + stage, { method: "PATCH", version: drafts[stage].version, json: { body: formatted, sharedBindings: drafts[stage].shared_bindings, secretBindings: drafts[stage].secret_bindings } });
			setDrafts((previous) => (previous ? { ...previous, [stage]: saved } : previous));
			setSavedDrafts((previous) => (previous ? { ...previous, [stage]: saved } : previous));
			setNotice("");
		} catch (cause) {
			failed(cause);
		} finally {
			setBusy(false);
		}
	}

	async function publish() {
		if (!drafts || !route) return;
		setBusy(true);
		setNotice("");
		setError("");
		setDiagnostics([]);
		try {
			let saved: Record<Stage, Draft> = { ...drafts };
			for (const slot of ["ingress", "processing"] as const) {
				const formatted = await formatScript(drafts[slot].body, slot, drafts[slot].shared_bindings);
				const value = await api<Draft>("/endpoints/" + endpointId + "/drafts/" + slot, { method: "PATCH", version: drafts[slot].version, json: { body: formatted, sharedBindings: drafts[slot].shared_bindings, secretBindings: drafts[slot].secret_bindings } });
				saved = { ...saved, [slot]: value };
				setDrafts((previous) => (previous ? { ...previous, [slot]: value } : previous));
				setSavedDrafts((previous) => (previous ? { ...previous, [slot]: value } : previous));
			}

			setDrafts(saved);
			const result = await api<{ id: string; version: number }>("/endpoints/" + endpointId + "/publications", { method: "POST", json: { expectedVersion: route.version, draftVersions: { ingress: saved.ingress.version, processing: saved.processing.version } } });
			setRoute((previous) => (previous ? { ...previous, version: result.version, activePublicationId: result.id } : previous));
			setHistory(await api<Publication[]>("/endpoints/" + endpointId + "/publications"));
			setNotice("Published. New events use this version; existing events keep their pinned version.");
		} catch (cause) {
			failed(cause);
		} finally {
			setBusy(false);
		}
	}

	async function toggleDelivery() {
		if (!route) return;
		setBusy(true);
		setError("");
		setNotice("");
		try {
			const result = await api<{ paused: boolean; version: number }>("/endpoints/" + endpointId + (route.paused ? "/resume" : "/pause"), { method: "POST", version: route.version, json: {} });
			setRoute((previous) => (previous ? { ...previous, ...result } : previous));
			setNotice(result.paused ? "Delivery paused. Ingress still stores events; already running sends may finish." : "Delivery resumed. Queued events can be claimed again.");
		} catch (cause) {
			failed(cause);
		} finally {
			setBusy(false);
		}
	}

	async function rollback(id: string) {
		if (!route) return;
		setBusy(true);
		setNotice("");
		setError("");
		try {
			const result = await api<{ id: string; version: number }>("/endpoints/" + endpointId + "/publications", { method: "PATCH", json: { publicationId: id, expectedVersion: route.version } });
			setRoute((previous) => (previous ? { ...previous, version: result.version, activePublicationId: result.id } : previous));
			setNotice("Recorded publication activated for new events.");
		} catch (cause) {
			failed(cause);
		} finally {
			setBusy(false);
		}
	}

	if (loading) return <p role='status'>Loading route configuration…</p>;
	if (!route)
		return (
			<section>
				<h1 className='text-2xl font-semibold'>Route unavailable</h1>

				<Button onPress={() => void load()}>Retry</Button>
			</section>
		);
	const editable = route.permissions.includes("code.edit");
	const publishable = route.permissions.includes("code.publish");

	return (
		<section className='flex min-w-0 flex-col gap-6'>
			<Link href={"/projects/" + projectId} className='text-accent flex items-center gap-2 text-sm'>
				<IconArrowLeft size={16} />
				Back to project
			</Link>
			<header className='flex flex-wrap items-start justify-between gap-4'>
				<div>
					<p className='text-muted text-sm'>Ingress route</p>
					<h1 className='text-3xl font-semibold'>{route.name}</h1>
					<p aria-label='Delivery state' className='text-muted mt-2'>
						{route.paused ? "Delivery paused — ingress still accepts events." : "Delivery active."}
					</p>
					<p className='text-muted mt-2'>{route.activePublicationId ? "Published" : "Not published"} · Ingress responds to the sender; Processing handles queued events.</p>
				</div>
				{route.permissions.includes("endpoints.pause") && (
					<Button variant='secondary' isDisabled={busy} onPress={() => void toggleDelivery()}>
						{route.paused ? <IconPlayerPlay size={18} /> : <IconPlayerPause size={18} />} {route.paused ? "Resume delivery" : "Pause delivery"}
					</Button>
				)}
			</header>
			{route.ingressUrl && (
				<Card>
					<Card.Content className='flex min-w-0 flex-row items-center gap-3 py-4'>
						<div className='min-w-0 flex-1 overflow-hidden'>
							<p className='text-muted text-xs'>Receiving URL</p>
							<code className='bg-field mt-1 block overflow-x-auto whitespace-nowrap rounded-lg px-3 py-2 text-sm'>{route.ingressUrl}</code>
						</div>
						<Button
							size='sm'
							className='shrink-0'
							variant='secondary'
							onPress={async () => {
								try {
									await navigator.clipboard.writeText(route.ingressUrl!);
									setNotice("Receiving URL copied.");
								} catch {
									setError("Could not copy the URL; select and copy it manually.");
								}
							}}
						>
							<IconCopy size={16} />
							Copy URL
						</Button>
					</Card.Content>
				</Card>
			)}
			{error && (
				<div>
					<Button variant='ghost' onPress={() => void load()} isDisabled={busy}>
						Reload saved drafts (discards local edits)
					</Button>
				</div>
			)}

			{diagnostics.length > 0 && (
				<ul aria-label='Compilation diagnostics' className='text-danger font-mono text-sm'>
					{diagnostics.map((diagnostic, index) => (
						<li key={index}>
							{diagnostic.sourceId}:{diagnostic.line}:{diagnostic.column} — {diagnostic.message}
						</li>
					))}
				</ul>
			)}
			{drafts ? (
				<Tabs
					className='min-w-0 w-full'
					selectedKey={stage}
					onSelectionChange={(key) => {
						setStage(key as Stage);
						setNotice("");
					}}
				>
					<Tabs.ListContainer>
						<Tabs.List aria-label='Lifecycle scripts'>
							<Tabs.Tab id='ingress'>
								Ingress
								<Tabs.Indicator />
							</Tabs.Tab>
							<Tabs.Tab id='processing'>
								Processing
								<Tabs.Indicator />
							</Tabs.Tab>
						</Tabs.List>
					</Tabs.ListContainer>
					{(["ingress", "processing"] as const).map((slot) => (
						<Tabs.Panel key={slot} id={slot} className='flex min-w-0 flex-col gap-4 pt-4'>
							<div className='flex flex-wrap items-center justify-between gap-3'>
								<p className='text-muted text-sm'>{slot === "ingress" ? "Verify the raw request and return accept, reject, or a protocol-only response." : "Send to destinations or use bounded fetch, then choose complete, retry, or fail."}</p>
								{editable && (
									<NativeSelect className='w-full sm:w-auto' variant='secondary'>
										<Label>Start from a template</Label>
										<NativeSelect.Trigger
											aria-label={slot === "ingress" ? "Ingress template" : "Processing template"}
											defaultValue=''
											onChange={(event) => {
												const selected = event.target.value;
												if (selected === "hmac") void change(hmacTemplate.body);
												else if (selected === "unverified") void change(unverifiedTemplate.body);
												else if (selected === "delivery") void change(deliveryTemplate.body);
												event.target.value = "";
											}}
										>
											<NativeSelect.Option value=''>Choose editable template</NativeSelect.Option>
											{slot === "ingress" ? (
												<>
													<NativeSelect.Option value='hmac'>Generic HMAC SHA-256</NativeSelect.Option>
													<NativeSelect.Option value='unverified'>Explicitly unverified</NativeSelect.Option>
												</>
											) : (
												<NativeSelect.Option value='delivery'>Deliver to default destination</NativeSelect.Option>
											)}
											<NativeSelect.Indicator />
										</NativeSelect.Trigger>
									</NativeSelect>
								)}
							</div>
							<div className='min-w-0'>
								<CodeEditor
									key={slot}
									label={slot === "ingress" ? "Ingress code" : "Processing code"}
									value={drafts[slot].body}
									stage={slot}
									bindings={drafts[slot].shared_bindings}
									onSave={editable && !busy ? () => void save() : undefined}
									onChange={(body) => {
										setNotice("");
										setDrafts((previous) => (previous ? { ...previous, [slot]: { ...previous[slot], body } } : previous));
									}}
									readOnly={!editable || busy}
								/>
							</div>
							<Accordion>
								<Accordion.Item id='bindings'>
									<Accordion.Heading>
										<Accordion.Trigger>
											Helpers and secrets
											<Accordion.Indicator>
												<IconChevronDown />
											</Accordion.Indicator>
										</Accordion.Trigger>
									</Accordion.Heading>
									<Accordion.Panel>
										<Accordion.Body className='flex flex-col gap-4'>
											<SharedBindings
												projectId={projectId}
												bindings={drafts[slot].shared_bindings}
												disabled={busy || !editable}
												onChange={(shared_bindings) => {
													setDrafts((previous) => (previous ? { ...previous, [slot]: { ...previous[slot], shared_bindings } } : previous));
													setNotice("");
												}}
											/>
											<SecretBindings
												projectId={projectId}
												bindings={drafts[slot].secret_bindings}
												canUse={route.permissions.includes("secrets.use")}
												canManage={route.permissions.includes("secrets.manage")}
												disabled={!editable || busy}
												onChange={(bindings) => {
													setNotice("");
													setDrafts((previous) => (previous ? { ...previous, [slot]: { ...previous[slot], secret_bindings: bindings } } : previous));
												}}
											/>
										</Accordion.Body>
									</Accordion.Panel>
								</Accordion.Item>
							</Accordion>
							{editable && (
								<div className='flex flex-wrap items-center gap-3'>
									<Button variant='secondary' isDisabled={busy} onPress={() => void save()}>
										<IconCheck size={16} />
										Save draft
									</Button>
									{publishable && drafts && (
										<Button onPress={() => void publish()} isDisabled={busy || !editable}>
											<IconUpload size={18} />
											{busy ? "Working…" : "Publish both stages"}
										</Button>
									)}
									<span className='text-muted text-xs'>
										{JSON.stringify(drafts[slot]) !== JSON.stringify(savedDrafts?.[slot]) ? "Unsaved changes" : "Draft saved"} · {route.activePublicationId ? "Publish to activate edits" : "Not published"}
									</span>
								</div>
							)}
						</Tabs.Panel>
					))}
				</Tabs>
			) : (
				<p className='text-muted'>You need code-reading permission to inspect these scripts.</p>
			)}
			{drafts && route.permissions.includes("code.test") && (
				<Accordion>
					<Accordion.Item id='script-test'>
						<Accordion.Heading>
							<Accordion.Trigger>
								Test this script
								<Accordion.Indicator>
									<IconChevronDown />
								</Accordion.Indicator>
							</Accordion.Trigger>
						</Accordion.Heading>
						<Accordion.Panel>
							<Accordion.Body>
								<Card>
									<Card.Header>
										<h2 className='text-lg font-semibold'>Synthetic script test</h2>
										<Card.Description>Test the current {stage} body without saving or publishing. Real secrets are not loaded. Direct fetch is blocked; managed sends are simulated as HTTP 204.</Card.Description>
									</Card.Header>
									<Card.Content className='flex flex-col gap-4'>
										<label className='flex flex-col gap-2 text-sm'>
											Synthetic request body
											<TextArea variant='secondary' aria-label='Synthetic request body' value={testBody} onChange={(event) => setTestBody(event.target.value)} className='min-h-24 font-mono' />
										</label>
										<div className='grid gap-4 sm:grid-cols-2'>
											<label className='flex flex-col gap-2 text-sm'>
												Synthetic headers (JSON)
												<TextArea variant='secondary' aria-label='Synthetic headers' value={testHeaders} onChange={(event) => setTestHeaders(event.target.value)} className='font-mono' />
											</label>
											<label className='flex flex-col gap-2 text-sm'>
												Synthetic secrets (JSON)
												<TextArea variant='secondary' aria-label='Synthetic secrets' value={testSecrets} onChange={(event) => setTestSecrets(event.target.value)} className='font-mono' />
											</label>
										</div>
										<Button variant='secondary' isDisabled={busy} onPress={() => void testSynthetic()}>
											Test {stage} (dry)
										</Button>
										{testResult !== null && (
											<pre aria-label='Synthetic test result' className='bg-field max-h-96 overflow-auto rounded-lg p-4 font-mono text-sm'>
												{JSON.stringify(testResult, null, 2)}
											</pre>
										)}
									</Card.Content>
								</Card>
							</Accordion.Body>
						</Accordion.Panel>
					</Accordion.Item>
				</Accordion>
			)}
			{drafts && history.length > 0 && (
				<Card>
					<Card.Header>
						<h2 className='text-lg font-semibold'>Publication history</h2>
						<Card.Description>Rollback changes new events; queued events retain their original publication.</Card.Description>
					</Card.Header>
					<Card.Content>
						<ul className='flex flex-col gap-3'>
							{history.map((publication) => (
								<li key={publication.id} className='flex flex-wrap items-center justify-between gap-3'>
									<div>
										<code className='text-xs'>{publication.id.slice(0, 8)}</code>
										<span className='text-muted ml-3 text-sm'>{new Date(publication.created_at).toLocaleString()}</span>
										{publication.id === route.activePublicationId && <span className='text-success ml-3 text-xs'>Active</span>}
									</div>
									{publishable && publication.id !== route.activePublicationId && (
										<Button size='sm' variant='secondary' isDisabled={busy} onPress={() => void rollback(publication.id)}>
											Activate this version
										</Button>
									)}
								</li>
							))}
						</ul>
					</Card.Content>
				</Card>
			)}
		</section>
	);
}
