"use client";

import { TrafficChart } from "@components/traffic-chart";
import type { TrafficSnapshot } from "@types";
import { useLiveSubscription } from "@components/live-subscription";
import { LoadingState } from "@components/loading-state";
import { useFeedbackToast } from "@lib/feedback";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { EventBrowser } from "@components/event-browser";
import { useUnsavedChanges } from "@components/unsaved-changes";
import { ScriptingGuide } from "@components/scripting-guide";
import { use, useState, useEffect, useCallback } from "react";
import { Button, Card, Tabs, Checkbox, Label, Input, Chip, Table, Modal, ComboBox, TextField, Select, ListBox } from "@heroui/react";
import { IconArrowLeft, IconCheck, IconUpload, IconPlayerPause, IconPlayerPlay, IconCopy, IconInfoCircle, IconPlayerTrackNext, IconArchive, IconArchiveOff, IconTrash } from "@tabler/icons-react";

import { formatScript, formatScriptForDisplay, scriptDocument } from "@lib/script-document";
import { HelperImportPicker } from "@components/helper-import-picker";
import { HttpRequestEditor, validateHttpBody, bodyContentTypes, type BodyFormat } from "@components/http-request-editor";
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
	archived: boolean;
};

type ScriptTestResult = {
	mode: string;
	middlewareCount: number;
	checks: {
		name: string;
		passed: boolean;
		expected: string | number;
		actual?: unknown;
	}[];
	decision: { kind: string; [key: string]: unknown };
	logs: { level: string; message: string }[];
	durationMs: number;
};

export default function RoutePage({ params }: { params: Promise<{ projectId: string; endpointId: string }> }) {
	const { projectId, endpointId } = use(params);

	const section = useSearchParams().get("section") ?? "overview";

	const { subscribe } = useLiveSubscription();

	const [activityResult, setActivity] = useState<{ id: string; data: TrafficSnapshot } | null>(null);

	const [activityError, setActivityError] = useState("");
	const [activityRetry, setActivityRetry] = useState(0);

	useFeedbackToast(activityError, "", { error: "Traffic unavailable" });

	const activity = activityResult?.id === endpointId ? activityResult.data : null;

	useEffect(() => {
		if (section !== "overview") return;
		let active = true;

		const loadActivity = () => {
			void api<TrafficSnapshot>("/overview?endpointId=" + endpointId)
				.then((next) => {
					if (active) {
						setActivity({ id: endpointId, data: next });
						setActivityError("");
					}
				})
				.catch(() => {
					if (active) {
						setActivity(null);
						setActivityError("Could not load route traffic.");
					}
				});
		};

		let timer: ReturnType<typeof setTimeout> | undefined;

		const refresh = () => {
			if (!timer)
				timer = setTimeout(() => {
					timer = undefined;
					loadActivity();
				}, 150);
		};

		loadActivity();
		const stops = (["event.recorded", "execution.changed", "attempt.completed", "resync-required"] as const).map((kind) => subscribe(kind, refresh));

		return () => {
			active = false;
			if (timer) clearTimeout(timer);
			for (const stop of stops) stop();
		};
	}, [endpointId, section, subscribe, activityRetry]);

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
	const [bodyLanguage, setBodyLanguage] = useState<BodyFormat>("json");
	const [requestHeaders, setRequestHeaders] = useState("{}");
	const [sending, setSending] = useState(false);
	const [requestResult, setRequestResult] = useState<{
		status: number;
		body: string;
		headers: Record<string, string>;
	} | null>(null);
	const [expectedDecision, setExpectedDecision] = useState("");
	const [statusInput, setStatusInput] = useState("");

	const expectedStatus = /^[1-5]\d{2}$/.test(statusInput) ? Number(statusInput) : NaN;

	const [expectedBody, setExpectedBody] = useState("");
	const [includeMiddleware, setIncludeMiddleware] = useState(true);
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
			if (!["GET", "HEAD"].includes(requestMethod)) validateHttpBody(bodyLanguage, testBody);
			const outgoingHeaders = new Headers(headers as Record<string, string>);
			if (!outgoingHeaders.has("content-type")) outgoingHeaders.set("content-type", bodyContentTypes[bodyLanguage]);
			const response = await fetch(route.ingressUrl, {
				method: requestMethod,
				credentials: "omit",
				headers: outgoingHeaders,
				redirect: "error",
				signal: AbortSignal.timeout(15000),
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
			if (stage === "ingress" && statusInput && !Number.isFinite(expectedStatus)) throw Error("Choose an HTTP status from 100 to 599.");
			if (stage === "processing" || !["GET", "HEAD"].includes(requestMethod)) validateHttpBody(bodyLanguage, testBody);
			const result = await api<unknown>("/endpoints/" + endpointId + "/test", {
				method: "POST",
				json: {
					stage,
					includeMiddleware,
					expectations: { ...(expectedDecision ? { decision: expectedDecision } : {}), ...(stage === "ingress" && Number.isFinite(expectedStatus) ? { status: expectedStatus } : {}), ...(stage === "ingress" && expectedBody ? { bodyContains: expectedBody } : {}) },
					body: drafts[stage].body,
					sharedBindings: drafts[stage].shared_bindings,
					fixture: {
						body: stage === "ingress" && ["GET", "HEAD"].includes(requestMethod) ? "" : testBody,
						method: requestMethod,
						contentType: bodyContentTypes[bodyLanguage],
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

	async function save(allStages = false) {
		if (!drafts) return;
		setBusy(true);
		setNotice("");
		setError("");
		setDiagnostics([]);
		try {
			for (const slot of allStages ? (["ingress", "processing"] as const) : [stage]) {
				const formatted = await formatScript(drafts[slot].body, slot === "ingress" ? undefined : slot, drafts[slot].shared_bindings);
				const saved = await api<Draft>("/endpoints/" + endpointId + "/drafts/" + slot, { method: "PATCH", version: drafts[slot].version, json: { body: formatted, sharedBindings: drafts[slot].shared_bindings, secretBindings: drafts[slot].secret_bindings } });
				setDrafts((previous) => (previous ? { ...previous, [slot]: saved } : previous));
				setSavedDrafts((previous) => (previous ? { ...previous, [slot]: saved } : previous));
			}

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

	async function archive(publication: Publication) {
		if (!route) return;
		setNotice("");
		setBusy(true);
		setError("");
		try {
			await api("/endpoints/" + endpointId + "/publications", { method: "PATCH", json: { publicationId: publication.id, expectedVersion: route.version, archived: !publication.archived } });
			await load();
			setNotice(publication.archived ? "Publication restored" : "Publication archived");
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not update publication");
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
			<Link href={"/projects/" + projectId} className='button button--secondary w-fit'>
				<IconArrowLeft size={16} />
				Back to project
			</Link>
			<header className='flex flex-wrap items-start justify-between gap-4'>
				<div>
					{section === "overview" && <p className='text-muted text-sm'>Ingress route</p>}
					{drafts && savedDrafts && JSON.stringify(drafts) !== JSON.stringify(savedDrafts) && (
						<Chip size='sm' color='warning'>
							Unsaved changes
						</Chip>
					)}
					<h1 className='text-3xl font-semibold'>
						{section === "overview"
							? route.name
							: ({
									code: "Scripts",
									secrets: "Secrets",
									playground: "Playground",
									test: "Script test",
									events: "Route events",
									history: "Publication history",
								}[section] ?? "Route")}
					</h1>
					{section === "overview" && (
						<div className='mt-3 flex flex-wrap items-center gap-2' aria-label='Route status'>
							<Chip color={route.activePublicationId ? "success" : "default"} size='sm'>
								{route.activePublicationId ? "Published" : "Draft"}
							</Chip>
							<Chip color={route.paused ? "warning" : "success"} size='sm' aria-label='Delivery state'>
								{route.paused ? "Delivery paused — ingress still accepts events." : "Delivery active."}
							</Chip>
						</div>
					)}
				</div>
				{section === "overview" && route.permissions.includes("endpoints.pause") && (
					<Button variant='secondary' isDisabled={busy} onPress={() => void toggleDelivery()}>
						{route.paused ? <IconPlayerPlay size={18} /> : <IconPlayerPause size={18} />} {route.paused ? "Resume delivery" : "Pause delivery"}
					</Button>
				)}
			</header>
			{section === "overview" && route.ingressUrl && (
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
			{section === "overview" && (
				<div className='flex flex-wrap gap-3'>
					{route.permissions.includes("code.read") && (
						<Link href={"?section=code"} className='button button--primary'>
							Open scripts
						</Link>
					)}
					<Link href='?section=events' className='button button--secondary'>
						View events
					</Link>
					<Link href='?section=playground' className='button button--secondary'>
						Open playground
					</Link>
				</div>
			)}
			{section === "overview" &&
				!activity &&
				(activityError ? (
					<Button variant='secondary' onPress={() => setActivityRetry((value) => value + 1)}>
						Retry loading route traffic
					</Button>
				) : (
					<LoadingState label='Loading route traffic…' />
				))}
			{section === "overview" && activity && (
				<>
					<TrafficChart overview={activity} />
					<section className='flex flex-col gap-3'>
						<h2 className='text-xl font-semibold'>Recent executions</h2>
						<Table>
							<Table.ScrollContainer>
								<Table.Content aria-label='Route recent executions' className='w-full'>
									<Table.Header>
										<Table.Column isRowHeader>Started</Table.Column>
										<Table.Column>Status</Table.Column>
										<Table.Column>Attempts</Table.Column>
									</Table.Header>
									<Table.Body>
										{activity.recent.map((item) => (
											<Table.Row key={item.id} id={item.id} href='?section=events'>
												<Table.Cell>{new Date(item.created_at).toLocaleString()}</Table.Cell>
												<Table.Cell>
													<Chip size='sm' color={item.state === "succeeded" ? "success" : item.state === "failed_terminal" ? "danger" : "default"}>
														{item.state}
													</Chip>
												</Table.Cell>
												<Table.Cell>{item.attempt_number}</Table.Cell>
											</Table.Row>
										))}
									</Table.Body>
								</Table.Content>
							</Table.ScrollContainer>
							{!activity.recent.length && <Table.Footer>No executions yet.</Table.Footer>}
						</Table>
					</section>
				</>
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
			{drafts && section === "code" ? (
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
									<Select
										className='w-full sm:w-auto'
										variant='secondary'
										aria-label={slot === "ingress" ? "Ingress template" : "Processing template"}
										value={templates[slot] ?? ""}
										onChange={(key) => {
											const selected = String(key ?? "");
											setTemplates((previous) => ({ ...previous, [slot]: selected }));
											if (selected === "hmac") void change(hmacHttpTemplate.source);
											else if (selected === "unverified") void change(unverifiedHttpTemplate.source);
											else if (selected === "delivery") void change(scriptDocument(deliveryTemplate.body, "processing"));
										}}
									>
										<Label>Start from a template</Label>
										<Select.Trigger>
											<Select.Value />
											<Select.Indicator />
										</Select.Trigger>
										<Select.Popover>
											<ListBox>
												<ListBox.Item id=''>
													Choose editable template
													<ListBox.ItemIndicator />
												</ListBox.Item>
												{slot === "ingress" ? (
													<>
														<ListBox.Item id='hmac'>
															Generic HMAC SHA-256
															<ListBox.ItemIndicator />
														</ListBox.Item>
														<ListBox.Item id='unverified'>
															Explicitly unverified
															<ListBox.ItemIndicator />
														</ListBox.Item>
													</>
												) : (
													<ListBox.Item id='delivery'>
														Deliver to default destination
														<ListBox.ItemIndicator />
													</ListBox.Item>
												)}
											</ListBox>
										</Select.Popover>
									</Select>
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
										{JSON.stringify(drafts[slot]) !== JSON.stringify(savedDrafts?.[slot]) ? "Unsaved changes" : "Draft saved"} / {route.activePublicationId ? "Publish to activate edits" : "Not published"}
									</span>
								</div>
							)}
						</Tabs.Panel>
					))}
				</Tabs>
			) : !drafts && section === "code" ? (
				<p className='text-muted'>You need code-reading permission to inspect these scripts.</p>
			) : null}
			{section === "secrets" && drafts && (
				<>
					<SecretBindings
						projectId={projectId}
						bindings={drafts.ingress.secret_bindings}
						onChange={(bindings) => setDrafts((previous) => (previous ? { ...previous, ingress: { ...previous.ingress, secret_bindings: bindings } } : previous))}
						availability={{ bindings: { ingress: drafts.ingress.secret_bindings, processing: drafts.processing.secret_bindings }, onChange: (bindings) => setDrafts((previous) => (previous ? { ingress: { ...previous.ingress, secret_bindings: bindings.ingress }, processing: { ...previous.processing, secret_bindings: bindings.processing } } : previous)) }}
						canUse={route.permissions.includes("secrets.use")}
						canManage={route.permissions.includes("secrets.manage")}
						disabled={!editable || busy}
					/>
					{editable && (
						<div className='flex flex-wrap items-center justify-center gap-3 sm:justify-start'>
							<Button variant='secondary' isDisabled={busy} onPress={() => void save(true)}>
								Save draft
							</Button>
							{publishable && (
								<Button isDisabled={busy} onPress={() => void publish()}>
									Publish both stages
								</Button>
							)}
							<span className='text-muted text-xs'>{JSON.stringify(drafts) === JSON.stringify(savedDrafts) ? "Draft saved" : "Unsaved changes"}</span>
						</div>
					)}
				</>
			)}

			{section === "events" && <EventBrowser projectId={projectId} endpointId={endpointId} embedded />}
			{section === "playground" && (
				<section aria-label='Webhook request client' className='bg-surface border-border flex min-w-0 flex-col overflow-hidden rounded-xl border'>
					<header className='bg-surface border-border flex flex-col gap-3 border-b p-4'>
						<h2 className='text-xl font-semibold'>Webhook playground</h2>
						<p className='text-muted text-sm'>Send a real request to the published route. Accepted events enter the queue; all received requests remain inspectable. Use synthetic data.</p>
					</header>
					<div className='grid min-w-0 divide-y lg:grid-cols-2 lg:divide-x lg:divide-y-0'>
						<div className='min-w-0 p-4'>
							<HttpRequestEditor
								body={testBody}
								headers={requestHeaders}
								format={bodyLanguage}
								method={requestMethod}
								bodyLabel='Playground request body'
								headersLabel='Playground request headers'
								onBodyChange={setTestBody}
								onHeadersChange={setRequestHeaders}
								onFormatChange={setBodyLanguage}
								onMethodChange={setRequestMethod}
								action={
									<Button onPress={() => void sendRequest()} isPending={sending} isDisabled={!route.activePublicationId || sending}>
										Send request
									</Button>
								}
							/>
						</div>
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
											<p>This test runs the current {stage} handler without saving or publishing it. Enabled middleware runs in its configured order when Include middleware is selected.</p>
											<p>Use sample secret values below. Real secrets are not loaded, direct fetch is blocked, and managed deliveries return a simulated HTTP 204.</p>
											<p>To test actual HTTP delivery, publish the route and use the playground.</p>
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
						<HttpRequestEditor
							body={testBody}
							headers={testHeaders}
							secrets={testSecrets}
							format={bodyLanguage}
							method={stage === "ingress" ? requestMethod : undefined}
							methodLabel='Synthetic HTTP method'
							bodyLabel='Synthetic request body'
							headersLabel='Synthetic headers'
							onBodyChange={setTestBody}
							onHeadersChange={setTestHeaders}
							onSecretsChange={setTestSecrets}
							onFormatChange={setBodyLanguage}
							onMethodChange={setRequestMethod}
							checks={
								<div className='flex flex-col gap-4'>
									<Select variant='secondary' aria-label='Expected decision' value={expectedDecision} onChange={(key) => setExpectedDecision(String(key ?? ""))}>
										<Label>Expected decision</Label>
										<Select.Trigger>
											<Select.Value />
											<Select.Indicator />
										</Select.Trigger>
										<Select.Popover>
											<ListBox>
												<ListBox.Item id=''>
													No decision check
													<ListBox.ItemIndicator />
												</ListBox.Item>
												{(stage === "ingress" ? ["accept", "reject", "respondOnly"] : ["complete", "retry", "fail"]).map((decision) => (
													<ListBox.Item key={decision} id={decision}>
														{decision}
														<ListBox.ItemIndicator />
													</ListBox.Item>
												))}
											</ListBox>
										</Select.Popover>
									</Select>
									{stage === "ingress" && (
										<>
											<ComboBox allowsCustomValue variant='secondary' inputValue={statusInput} onInputChange={setStatusInput}>
												<Label>Expected HTTP status</Label>
												<ComboBox.InputGroup>
													<Input aria-label='Expected HTTP status' placeholder='e.g. 200' inputMode='numeric' />
													<ComboBox.Trigger />
												</ComboBox.InputGroup>
												<ComboBox.Popover>
													<ListBox>
														{[200, 201, 202, 204, 301, 302, 400, 401, 403, 404, 409, 422, 429, 500, 502, 503].map((status) => (
															<ListBox.Item id={String(status)} key={status} textValue={String(status)}>
																{status}
																<ListBox.ItemIndicator />
															</ListBox.Item>
														))}
													</ListBox>
												</ComboBox.Popover>
											</ComboBox>
											<TextField value={expectedBody} onChange={setExpectedBody}>
												<Label>Response body contains</Label>
												<Input variant='secondary' placeholder='Optional expected text' />
											</TextField>
										</>
									)}
								</div>
							}

							controls={
								<Select
									variant='secondary'
									className='w-40'
									aria-label='Script stage'
									value={stage}
									onChange={(key) => {
										setStage(String(key ?? "") as Stage);
										setExpectedDecision("");
									}}
								>
									<Label>Script stage</Label>
									<Select.Trigger>
										<Select.Value />
										<Select.Indicator />
									</Select.Trigger>
									<Select.Popover>
										<ListBox>
											<ListBox.Item id='ingress'>
												Ingress
												<ListBox.ItemIndicator />
											</ListBox.Item>
											<ListBox.Item id='processing'>
												Processing
												<ListBox.ItemIndicator />
											</ListBox.Item>
										</ListBox>
									</Select.Popover>
								</Select>
							}
							action={
								<Button isPending={busy} isDisabled={busy} onPress={() => void testSynthetic()}>
									Test {stage} (dry)
								</Button>
							}
						/>
						<Checkbox variant='secondary' isSelected={includeMiddleware} onChange={setIncludeMiddleware} isDisabled={busy}>
							<Checkbox.Content>
								<Checkbox.Control>
									<Checkbox.Indicator />
								</Checkbox.Control>
								<span>Include middleware</span>
							</Checkbox.Content>
						</Checkbox>
						{testResult !== null && (
							<section aria-label='Synthetic test result' className='border-border flex flex-col gap-4 border-t pt-4'>
								<div className='flex flex-wrap items-center gap-3'>
									<Chip>{testResult.decision.kind}</Chip>
									{testResult.checks.length > 0 && (
										<Chip color={testResult.checks.every((check) => check.passed) ? "success" : "danger"}>
											{testResult.checks.filter((check) => check.passed).length}/{testResult.checks.length} checks passed
										</Chip>
									)}
									<span className='text-muted text-sm'>
										{testResult.durationMs} ms / {testResult.middlewareCount} middleware / simulated effects
									</span>
								</div>
								{testResult.checks.length > 0 && (
									<ul aria-label='Test checks' className='flex flex-col gap-2'>
										{testResult.checks.map((check) => (
											<li key={check.name} className='flex flex-wrap items-center gap-2'>
												<Chip size='sm' color={check.passed ? "success" : "danger"}>
													{check.passed ? "Pass" : "Fail"}
												</Chip>
												<span>
													{check.name}: {String(check.expected)}
												</span>
												{!check.passed && check.actual !== undefined && <span className='text-muted'>Received {String(check.actual)}</span>}
											</li>
										))}
									</ul>
								)}

								<h3 className='font-semibold'>Handler decision</h3>
								<pre className='bg-field max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-lg p-4 font-mono text-sm'>{JSON.stringify(testResult.decision, null, 2)}</pre>
								<h3 className='font-semibold'>Execution logs</h3>
								<div className='flex flex-wrap items-end gap-3'>
									<Select variant='secondary' aria-label='Log level' value={logLevel} onChange={(key) => setLogLevel(String(key ?? ""))}>
										<Label>Log level</Label>
										<Select.Trigger>
											<Select.Value />
											<Select.Indicator />
										</Select.Trigger>
										<Select.Popover>
											<ListBox>
												{["all", "debug", "info", "warn", "error"].map((level) => (
													<ListBox.Item key={level} id={level}>
														{level === "all" ? "All levels" : level}
														<ListBox.ItemIndicator />
													</ListBox.Item>
												))}
											</ListBox>
										</Select.Popover>
									</Select>
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
										<Table.Column className='text-right'>Actions</Table.Column>
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
														{publication.archived && (
															<Chip size='sm' color='warning'>
																Archived
															</Chip>
														)}
													</div>
												</Table.Cell>
												<Table.Cell>{new Date(publication.created_at).toLocaleString()}</Table.Cell>
												<Table.Cell className='text-right [&>div]:justify-end'>
													<div className='flex gap-2'>
														<Button
															variant='secondary'
															size='sm'
															isIconOnly
															aria-label={"Activate publication v" + publication.version_number}
															aria-description={publication.id === route.activePublicationId ? "This version is already active" : publication.archived ? "Restore this version before activating it" : !publishable ? "Publishing permission is required" : "Activate this version for new events"}
															isDisabled={busy || !publishable || publication.archived || publication.id === route.activePublicationId}
															onPress={() => void rollback(publication.id)}
														>
															<IconPlayerTrackNext size={18} aria-hidden='true' />
														</Button>
														<Button
															variant='secondary'
															size='sm'
															isIconOnly
															aria-label={(publication.archived ? "Restore" : "Archive") + " publication v" + publication.version_number}
															aria-description={publication.id === route.activePublicationId || index === 0 ? "Active and latest publications must remain available" : publication.archived ? "Restore this version to allow activation" : "Archive this version without changing stored events"}
															isDisabled={busy || !publishable || (!publication.archived && (publication.id === route.activePublicationId || index === 0))}
															onPress={() => void archive(publication)}
														>
															{publication.archived ? <IconArchiveOff size={16} aria-hidden='true' /> : <IconArchive size={16} aria-hidden='true' />}
														</Button>
														<Button variant='danger-soft' size='sm' isIconOnly aria-label={"Delete publication v" + publication.version_number} aria-description='Published versions are immutable and retained for event recovery. Archive an inactive version instead.' isDisabled>
															<IconTrash size={16} aria-hidden='true' />
														</Button>
													</div>
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
