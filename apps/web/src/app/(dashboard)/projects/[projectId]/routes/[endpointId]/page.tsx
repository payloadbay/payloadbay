"use client";

import { LoadingState } from "@components/loading-state";
import { useFeedbackToast } from "@lib/feedback";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { EventBrowser } from "@components/event-browser";
import { useUnsavedChanges } from "@components/unsaved-changes";
import { ScriptingGuide } from "@components/scripting-guide";
import { use, useState, useEffect, useCallback } from "react";
import { Button, Card, Tabs, TextArea, Label, Input, Chip, Table, Modal } from "@heroui/react";
import { IconArrowLeft, IconCheck, IconUpload, IconPlayerPause, IconPlayerPlay, IconCopy, IconInfoCircle } from "@tabler/icons-react";
import { NativeSelect } from "@heroui-pro/react";
import { formatScript, formatScriptForDisplay, scriptDocument } from "@lib/script-document";
import { HelperImportPicker } from "@components/helper-import-picker";
import { CodeEditor } from "@components/code-editor";
import { SecretBindings } from "@components/secret-bindings";
import { unpackWire } from "@contracts/wire";
import { api, ApiFailure } from "@lib/api-client";
import { hmacHttpTemplate } from "@sdk/templates/hmac";
import { unverifiedHttpTemplate } from "@sdk/templates/unverified";
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
type Publication = {
	id: string;
	created_at: string;
	version_number: number;
	active: boolean;
};

type ScriptTestResult = {
	mode: string;
	decision: { kind: string; [key: string]: unknown };
	logs: { level: string; message: string }[];
	durationMs: number;
};

export default function RoutePage({ params }: { params: Promise<{ projectId: string; endpointId: string }> }) {
	const { projectId, endpointId } = use(params);
	const section = useSearchParams().get("section") ?? "code";

	const [route, setRoute] = useState<Route | null>(null);
	const [drafts, setDrafts] = useState<Record<Stage, Draft> | null>(null);
	const [savedDrafts, setSavedDrafts] = useState<Record<Stage, Draft> | null>(null);
	const [history, setHistory] = useState<Publication[]>([]);

	const { dialog: unsavedDialog } = useUnsavedChanges(Boolean(drafts && savedDrafts && JSON.stringify(drafts) !== JSON.stringify(savedDrafts)));

	const [templates, setTemplates] = useState<Partial<Record<Stage, string>>>({});
	const [stage, setStage] = useState<Stage>("ingress");
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [diagnostics, setDiagnostics] = useState<CompilationDiagnostic[]>([]);

	useFeedbackToast(error, notice, { error: "Script configuration error", success: "Script status" });

	const [testBody, setTestBody] = useState('{"type":"purchase.completed","data":{"orderId":"demo-001","amount":4900,"currency":"EUR"}}');
	const [requestMethod, setRequestMethod] = useState("POST");
	const [bodyLanguage, setBodyLanguage] = useState<"json" | "plaintext">("json");
	const [requestHeaders, setRequestHeaders] = useState('{"content-type": "application/json"}');
	const [sending, setSending] = useState(false);
	const [requestResult, setRequestResult] = useState<{
		status: number;
		body: string;
		headers: Record<string, string>;
	} | null>(null);
	const [testHeaders, setTestHeaders] = useState("{}");
	const [testSecrets, setTestSecrets] = useState("{}");
	const [testResult, setTestResult] = useState<ScriptTestResult | null>(null);
	const [logLevel, setLogLevel] = useState("all");
	const [logSearch, setLogSearch] = useState("");

	const visibleLogs = testResult?.logs.filter((log) => (logLevel === "all" || log.level === logLevel) && log.message.toLowerCase().includes(logSearch.toLowerCase())) ?? [];

	async function sendRequest() {
		if (!route?.ingressUrl) return;
		setSending(true);
		setError("");
		setRequestResult(null);
		try {
			const headers: unknown = JSON.parse(requestHeaders);
			if (!headers || typeof headers !== "object" || Array.isArray(headers) || Object.values(headers).some((value) => typeof value !== "string")) throw Error("Request headers must be a JSON object with text values");
			const response = await fetch(route.ingressUrl, {
				method: requestMethod,
				credentials: "omit",
				headers: headers as Record<string, string>,
				...(!["GET", "HEAD"].includes(requestMethod) ? { body: testBody } : {}),
			});
			setRequestResult({
				status: response.status,
				body: await response.text(),
				headers: Object.fromEntries(response.headers),
			});
		} catch (cause) {
			failed(cause);
		} finally {
			setSending(false);
		}
	}

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
						method: requestMethod,
						contentType: "application/json",
						headers: JSON.parse(testHeaders),
						secrets: JSON.parse(testSecrets),
					},
				},
			});
			setTestResult(unpackWire(result) as ScriptTestResult);
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

		if (code) {
			code[0] = { ...code[0], body: await formatScriptForDisplay(code[0].body) };
			code[1] = { ...code[1], body: await formatScriptForDisplay(scriptDocument(code[1].body, "processing", code[1].shared_bindings)) };
		}

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
			body = await formatScript(body, stage === "ingress" ? undefined : stage);
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
			const formatted = await formatScript(drafts[stage].body, stage === "ingress" ? undefined : stage, drafts[stage].shared_bindings);
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
				const formatted = await formatScript(drafts[slot].body, slot === "ingress" ? undefined : slot, drafts[slot].shared_bindings);
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

	if (loading) return <LoadingState label='Loading route configuration…' size='page' />;
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
			{unsavedDialog}
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
					<Card.Header>
						<Card.Description>Receiving URL</Card.Description>
					</Card.Header>
					<Card.Content className='flex min-w-0 flex-row items-center gap-3 pb-4'>
						<div className='min-w-0 flex-1 overflow-hidden'>
							<code aria-label='Receiving URL' className='bg-field block overflow-x-auto whitespace-nowrap rounded-lg px-3 py-2 text-sm'>
								{route.ingressUrl}
							</code>
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
			{drafts && ["code", "secrets"].includes(section) ? (
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
								{editable && section === "code" && (
									<NativeSelect className='w-full sm:w-auto' variant='secondary'>
										<Label>Start from a template</Label>
										<NativeSelect.Trigger
											aria-label={slot === "ingress" ? "Ingress template" : "Processing template"}
											value={templates[slot] ?? ""}
											onChange={(event) => {
												const selected = event.target.value;
												setTemplates((previous) => ({ ...previous, [slot]: selected }));
												if (selected === "hmac") void change(hmacHttpTemplate.source);
												else if (selected === "unverified") void change(unverifiedHttpTemplate.source);
												else if (selected === "delivery") void change(scriptDocument(deliveryTemplate.body, "processing"));
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
							{section === "code" && (
								<div className='min-w-0'>
									<div className='mb-3 flex flex-wrap items-center justify-between gap-2'>
										<p className='text-muted max-w-prose text-sm'>{slot === "ingress" ? "Export a handler for each HTTP method you want this route to receive. Choose whether to queue the event or just reply." : "Process queued events and decide whether delivery is complete, should retry, or has failed."}</p>
										<div className='flex items-center gap-2'>
											<HelperImportPicker scope={{ type: "project", id: projectId }} body={drafts[slot].body} disabled={!editable || busy} onImport={(body, name, id) => setDrafts((previous) => (previous ? { ...previous, [slot]: { ...previous[slot], body, shared_bindings: { ...previous[slot].shared_bindings, [name]: id } } } : previous))} />
											<ScriptingGuide />
										</div>
									</div>
									<CodeEditor
										key={slot}
										label={slot === "ingress" ? "Ingress code" : "Processing code"}
										value={drafts[slot].body}
										helperScope={{ type: "project", id: projectId }}
										bindings={drafts[slot].shared_bindings}
										onSave={editable && !busy ? () => void save() : undefined}
										onChange={(body) => {
											setNotice("");
											setDrafts((previous) => (previous ? { ...previous, [slot]: { ...previous[slot], body } } : previous));
										}}
										readOnly={!editable || busy}
									/>
								</div>
							)}
							{section === "secrets" && (
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
							)}

							{editable && (
								<div className='flex flex-wrap items-center justify-center gap-3 sm:justify-start'>
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
			) : !drafts && section === "code" ? (
				<p className='text-muted'>You need code-reading permission to inspect these scripts.</p>
			) : null}
			{section === "events" && <EventBrowser projectId={projectId} endpointId={endpointId} embedded />}
			{section === "overview" && (
				<section aria-label='Webhook request client' className='border-border flex min-w-0 flex-col overflow-hidden rounded-xl border'>
					<header className='bg-surface border-border flex flex-col gap-3 border-b p-4'>
						<h2 className='text-xl font-semibold'>Webhook playground</h2>
						<p className='text-muted text-sm'>Send a real request to the published route. Accepted events enter the queue; all received requests remain inspectable. Use synthetic data.</p>
						<div className='flex min-w-0 flex-wrap items-end gap-3'>
							<NativeSelect variant='secondary' className='w-28 shrink-0'>
								<Label>Method</Label>
								<NativeSelect.Trigger aria-label='HTTP method' value={requestMethod} onChange={(event) => setRequestMethod(event.target.value)}>
									{["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map((method) => (
										<NativeSelect.Option key={method} value={method}>
											{method}
										</NativeSelect.Option>
									))}
									<NativeSelect.Indicator />
								</NativeSelect.Trigger>
							</NativeSelect>
							<Input aria-label='Request URL' readOnly value={route.ingressUrl ?? "Publish a route first"} variant='secondary' className='min-w-0 flex-1 font-mono text-sm' />
							<Button onPress={() => void sendRequest()} isPending={sending} isDisabled={!route.activePublicationId || sending}>
								Send request
							</Button>
						</div>
					</header>
					<div className='grid min-w-0 divide-y lg:grid-cols-2 lg:divide-x lg:divide-y-0'>
						<section aria-label='Request' className='flex min-w-0 flex-col gap-4 p-4'>
							<h3 className='font-semibold'>Request</h3>
							<Tabs defaultSelectedKey='body'>
								<Tabs.ListContainer>
									<Tabs.List aria-label='Request sections'>
										<Tabs.Tab id='body'>
											Body
											<Tabs.Indicator />
										</Tabs.Tab>
										<Tabs.Tab id='headers'>
											Headers
											<Tabs.Indicator />
										</Tabs.Tab>
									</Tabs.List>
								</Tabs.ListContainer>
								<Tabs.Panel id='body' className='pt-4'>
									{["GET", "HEAD"].includes(requestMethod) ? (
										<p className='text-muted text-sm'>This method sends no request body.</p>
									) : (
										<div className='flex flex-col gap-3'>
											<NativeSelect variant='secondary' className='w-40'>
												<Label>Body format</Label>
												<NativeSelect.Trigger aria-label='Body format' value={bodyLanguage} onChange={(event) => setBodyLanguage(event.target.value as "json" | "plaintext")}>
													<NativeSelect.Option value='json'>JSON</NativeSelect.Option>
													<NativeSelect.Option value='plaintext'>Text</NativeSelect.Option>
													<NativeSelect.Indicator />
												</NativeSelect.Trigger>
											</NativeSelect>
											<CodeEditor language={bodyLanguage} label='Playground request body' value={testBody} onChange={setTestBody} />
										</div>
									)}
								</Tabs.Panel>
								<Tabs.Panel id='headers' className='pt-4'>
									<CodeEditor language='json' label='Playground request headers' value={requestHeaders} onChange={setRequestHeaders} />
									<p className='text-muted mt-2 text-xs'>A JSON object of header names and values.</p>
								</Tabs.Panel>
							</Tabs>
						</section>
						<section aria-label='HTTP response' className='flex min-w-0 flex-col gap-4 p-4'>
							<div className='flex flex-wrap items-center justify-between gap-2'>
								<h3 className='font-semibold'>Response</h3>
								{requestResult && <Chip color={requestResult.status < 400 ? "success" : "danger"}>HTTP {requestResult.status}</Chip>}
							</div>
							{sending ? (
								<LoadingState label='Waiting for response…' />
							) : requestResult ? (
								<Tabs defaultSelectedKey='body'>
									<Tabs.ListContainer>
										<Tabs.List aria-label='Response sections'>
											<Tabs.Tab id='body'>
												Body
												<Tabs.Indicator />
											</Tabs.Tab>
											<Tabs.Tab id='headers'>
												Headers
												<Tabs.Indicator />
											</Tabs.Tab>
										</Tabs.List>
									</Tabs.ListContainer>
									<Tabs.Panel id='body' className='pt-4'>
										<pre aria-label='Response body' className='bg-field max-h-96 min-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg p-3 text-sm'>
											{requestResult.body || "Empty response body"}
										</pre>
									</Tabs.Panel>
									<Tabs.Panel id='headers' className='pt-4'>
										<pre aria-label='Response headers' className='bg-field max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-lg p-3 text-xs'>
											{JSON.stringify(requestResult.headers, null, 2)}
										</pre>
									</Tabs.Panel>
								</Tabs>
							) : (
								<p className='text-muted py-8 text-center text-sm'>Send a request to inspect its response here.</p>
							)}
						</section>
					</div>
					{!route.activePublicationId && <p className='text-muted p-4 text-sm'>Publish the scripts first to enable this receiving URL.</p>}
				</section>
			)}

			{section === "test" && drafts && route.permissions.includes("code.test") && (
				<Card>
					<Card.Header>
						<h2 className='text-lg font-semibold'>Synthetic script test</h2>
						<Card.Description>Try the current handler with sample input.</Card.Description>
						<Modal>
							<Button variant='ghost' size='sm'>
								<IconInfoCircle size={18} aria-hidden='true' />
								About script testing
							</Button>
							<Modal.Backdrop>
								<Modal.Container size='md'>
									<Modal.Dialog>
										<Modal.CloseTrigger />
										<Modal.Header>
											<Modal.Heading>What this test runs</Modal.Heading>
										</Modal.Header>
										<Modal.Body className='flex flex-col gap-3'>
											<p>This test runs the current {stage} handler without saving or publishing it. It does not run middleware.</p>
											<p>Use sample secret values below. Real secrets are not loaded, direct fetch is blocked, and managed deliveries return a simulated HTTP 204.</p>
											<p>To test middleware and actual HTTP behavior together, publish the route and use the webhook playground.</p>
										</Modal.Body>
										<Modal.Footer>
											<Button slot='close'>Got it</Button>
										</Modal.Footer>
									</Modal.Dialog>
								</Modal.Container>
							</Modal.Backdrop>
						</Modal>
					</Card.Header>
					<Card.Content className='flex flex-col gap-4'>
						<div className='grid gap-4 sm:grid-cols-2'>
							<NativeSelect variant='secondary'>
								<Label>Script stage</Label>
								<NativeSelect.Trigger aria-label='Script stage' value={stage} onChange={(event) => setStage(event.target.value as Stage)}>
									<NativeSelect.Option value='ingress'>Ingress</NativeSelect.Option>
									<NativeSelect.Option value='processing'>Processing</NativeSelect.Option>
									<NativeSelect.Indicator />
								</NativeSelect.Trigger>
							</NativeSelect>
							{stage === "ingress" && (
								<NativeSelect variant='secondary'>
									<Label>Synthetic HTTP method</Label>
									<NativeSelect.Trigger aria-label='Synthetic HTTP method' value={requestMethod} onChange={(event) => setRequestMethod(event.target.value)}>
										{["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map((method) => (
											<NativeSelect.Option key={method} value={method}>
												{method}
											</NativeSelect.Option>
										))}
										<NativeSelect.Indicator />
									</NativeSelect.Trigger>
								</NativeSelect>
							)}
						</div>
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
							<section aria-label='Synthetic test result' className='border-border flex flex-col gap-4 border-t pt-4'>
								<div className='flex flex-wrap items-center gap-3'>
									<Chip>{testResult.decision.kind}</Chip>
									<span className='text-muted text-sm'>{testResult.durationMs} ms · simulated effects</span>
								</div>
								<h3 className='font-semibold'>Handler decision</h3>
								<pre className='bg-field max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-lg p-4 font-mono text-sm'>{JSON.stringify(testResult.decision, null, 2)}</pre>
								<h3 className='font-semibold'>Execution logs</h3>
								<div className='flex flex-wrap items-end gap-3'>
									<NativeSelect variant='secondary'>
										<Label>Log level</Label>
										<NativeSelect.Trigger aria-label='Log level' value={logLevel} onChange={(event) => setLogLevel(event.target.value)}>
											{["all", "debug", "info", "warn", "error"].map((level) => (
												<NativeSelect.Option key={level} value={level}>
													{level === "all" ? "All levels" : level}
												</NativeSelect.Option>
											))}
											<NativeSelect.Indicator />
										</NativeSelect.Trigger>
									</NativeSelect>
									<Input aria-label='Search execution logs' placeholder='Search logs…' variant='secondary' value={logSearch} onChange={(event) => setLogSearch(event.target.value)} className='min-w-0 flex-1' />
								</div>
								{visibleLogs.length ? (
									<ul className='bg-field max-h-80 overflow-auto rounded-lg p-4 font-mono text-sm'>
										{testResult.logs
											.filter((log) => (logLevel === "all" || log.level === logLevel) && log.message.toLowerCase().includes(logSearch.toLowerCase()))
											.map((log, index) => (
												<li key={index}>
													<span className='text-muted'>{log.level}</span> {log.message}
												</li>
											))}
									</ul>
								) : (
									<p className='text-muted text-sm'>{testResult.logs.length ? "No logs match these filters." : "The handler did not write any logs."}</p>
								)}
							</section>
						)}
					</Card.Content>
				</Card>
			)}
			{section === "history" && drafts && history.length === 0 && <p className='text-muted'>Nothing published yet. Save and publish both scripts to activate this route.</p>}
			{section === "history" && drafts && history.length > 0 && (
				<Card>
					<Card.Header>
						<h2 className='text-lg font-semibold'>Publication history</h2>
						<Card.Description>Rollback changes new events; queued events retain their original publication.</Card.Description>
					</Card.Header>
					<Card.Content>
						<Table>
							<Table.ScrollContainer>
								<Table.Content aria-label='Publication history'>
									<Table.Header>
										<Table.Column isRowHeader>Version</Table.Column>
										<Table.Column>Status</Table.Column>
										<Table.Column>Published</Table.Column>
										<Table.Column>Actions</Table.Column>
									</Table.Header>
									<Table.Body>
										{history.map((publication, index) => (
											<Table.Row key={publication.id} id={publication.id}>
												<Table.Cell>v{publication.version_number}</Table.Cell>
												<Table.Cell>
													<div className='flex flex-wrap gap-2'>
														{publication.id === route.activePublicationId && (
															<Chip size='sm' color='success'>
																Active
															</Chip>
														)}
														{index === 0 && <Chip size='sm'>Latest</Chip>}
													</div>
												</Table.Cell>
												<Table.Cell>{new Date(publication.created_at).toLocaleString()}</Table.Cell>
												<Table.Cell>
													{publishable && publication.id !== route.activePublicationId && (
														<Button variant='secondary' size='sm' isDisabled={busy} onPress={() => void rollback(publication.id)}>
															Activate
														</Button>
													)}
												</Table.Cell>
											</Table.Row>
										))}
									</Table.Body>
								</Table.Content>
							</Table.ScrollContainer>
						</Table>
					</Card.Content>
				</Card>
			)}
		</section>
	);
}
